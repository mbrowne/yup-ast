import * as yup from 'yup';

import { getCustomValidator } from './custom.validators';

let DEBUG = false;

class ValidationError extends Error {}

/**
 * Allows setting of debugger for certain tests.
 * @param {boolean} newValue - True or false to set the DEBUG var.
 */
export function setDebug(newValue) {
    DEBUG = newValue;
}

/**
 * Searches for {substring} in {string}.
 * If found, returns the {string}, sliced after substring.
 *
 * @param {string} string - String to be sliced.
 * @param {string} substring - String to search for.
 * @returns {string|null} Null if no match found.
 */
function getSubString(string, substring) {
    if (!string) return null;

    const testedIndex = string.indexOf(substring);

    if (testedIndex > -1) {
        return string.slice(testedIndex + substring.length);
    }

    return null;
}

/**
 * Returns a function from yup, by passing in a function name from our schema.
 * @param {string} functionName - The string to search for a function.
 * @param {object} previousInstance - Object from previous validator result or yup itself.
 * @returns {function} Either the found yup function or the default validator.
 */
function getYupFunction(functionName, previousInstance = yup) {
    // Make sure we're dealing with a string
    if (Array.isArray(functionName)) {
        functionName = functionName[0];
    }

    // Attempt to retrieve any custom validators first
    const customValidator = getCustomValidator(functionName);
    if (customValidator) {
        return customValidator;
    }

    const yupName = getSubString(functionName, 'yup.');
    if (yupName && typeof previousInstance[yupName] === 'function') {
        return previousInstance[yupName].bind(previousInstance);
    }

    if (yupName && typeof yup[yupName] === 'function') {
        return yup[yupName].bind(yup);
    }

    throw new ValidationError('Could not find validator ' + functionName);
}

/**
 * Here we check to see if a passed array could be a prefix notation function.
 * @param {array} item - Item to be checked.
 * @param {any} item.functionName - We'll check this, and perhaps it's a prefix function name.
 * @returns {boolean} True if we are actually looking at prefix notation.
 */
function isPrefixNotation([functionName]) {
    if (Array.isArray(functionName)) {
        if (isPrefixNotation(functionName)) return true;
    }

    if (typeof functionName !== 'string') return false;
    if (functionName.indexOf('yup.') < 0) return false;

    return true;
}

/**
 * Ensure that the argument passed is an array.
 * @param {string|array} maybeArray - To be checked.
 * @returns {array} forced to array.
 */
function ensureArray(maybeArray) {
    if (!Array.isArray(maybeArray)) {
        return [maybeArray];
    }

    return maybeArray;
}

/**
 * Converts an array of ['yup.number'] to yup.number().
 * @param {[Any]} jsonArray - The validation array.
 * @param {object} previousInstance - The result of a call to yup.number()
 * i.e. an object schema validation set
 * @returns {function} generated yup validator
 */
function convertArray(arrayArgument, previousInstance = yup) {
    const [functionName, ...argsToPass] = ensureArray(arrayArgument);

    // Handle the case when we have a previous instance
    // but we don't want to use it for this transformation
    // [['yup.array'], ['yup.of', [['yup.object'], ['yup.shape'] ...]]]
    if (Array.isArray(functionName)) {
        return transformArray(arrayArgument);
    }

    const gotFunc = getYupFunction(functionName, previousInstance);

    // Special case: matches() expects a regex as the first argument;
    // need to convert to regex if a string was passed
    if (functionName === 'yup.matches' && typeof argsToPass[0] !== 'object') {
        const [regexString] = argsToPass
        if (typeof regexString !== 'string') {
            throw new ValidationError('The first argument to matches() must be either a RegExp or a string')
        }
        argsToPass[0] = new RegExp(regexString)
    }

    // Here we'll actually call the function
    // This might be something like yup.number().min(5)
    // We could be passing different types of arguments here
    // so we'll try to transform them before calling the function
    // yup.object().shape({ test: yup.string()}) should also be transformed
    const convertedArguments = transformAll(argsToPass, previousInstance);

    // Handle the case when we've got an array of empty elements
    if (Array.isArray(convertedArguments)) {
        if (convertedArguments.filter(i => i).length < 1) {
            return gotFunc();
        }

        // Spread the array over the function
        return gotFunc(...convertedArguments);
    }

    // Handle the case when we're passing another validator
    return gotFunc(convertedArguments);
}

/**
 * Transforms an array JSON schema to yup array schema.
 *
 * @param {array} jsonArray - array in JSON to be transformed.
 * @returns {array} Array with same keys, but values as yup validators.
 */
function transformArray(jsonArray, previousInstance = yup) {
    let toReturn = convertArray(jsonArray[0], previousInstance);

    jsonArray.slice(1).forEach(item => {
        // Found an array, move to prefix extraction
        if (Array.isArray(item)) {
            toReturn = convertArray(item, toReturn);
            return;
        }

        // Found an object, move to object extraction
        if (item === 'object') {
            toReturn = transformObject(item, previousInstance);
            return;
        }

        // Handle an edge case where we have something like
        // [['yup.ref', 'linkName'], 'custom error'], and we don't want
        // to consume 'custom error as a variable yet'
        if (Array.isArray(toReturn)) {
            toReturn = toReturn.concat(item);
            return;
        }

        toReturn = [toReturn, item];
    });

    return toReturn;
}

/**
 * Transforms an object JSON schema to yup object schema.
 *
 * @param {object} jsonObject - Object in JSON to be transformed.
 * @returns {object} Object with same keys, but values as yup validators.
 */
export function transformObject(jsonObject, previousInstance = yup) {
    const toReturn = {};

    Object.entries(jsonObject).forEach(([key, value]) => {
        // Found an array move to array extraction
        if (Array.isArray(value)) {
            toReturn[key] = transformArray(value, previousInstance);
            return;
        }

        // Found an object recursive extraction
        if (typeof value === 'object') {
            toReturn[key] = transformObject(value, previousInstance);
            return;
        }

        toReturn[key] = value;
    });

    return toReturn;
}

/**
 * Steps into arrays and objects and resolve the items inside to yup validators.
 * @param {object|array} jsonObjectOrArray - Object to be transformed.
 * @returns {yup.Validator}
 */
export function transformAll(jsonObjectOrArray, previousInstance = yup) {
    // We're dealing with an array
    // This could be a prefix notation function
    // If so, we'll call the converter
    if (Array.isArray(jsonObjectOrArray)) {
        if (isPrefixNotation(jsonObjectOrArray)) {
            return transformArray(jsonObjectOrArray, previousInstance);
        }

        return jsonObjectOrArray.map(i => transformAll(i, previousInstance));
    }

    // If we're dealing with an object
    // we should check each of the values for that object.
    // Some of them may also be prefix notation functiosn
    if (typeof jsonObjectOrArray === 'object' && !isRegExp(jsonObjectOrArray)) {
        return transformObject(jsonObjectOrArray, previousInstance);
    }

    // No case here, just return anything else
    return jsonObjectOrArray;
}

function isRegExp(obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]'
}

/**
 * Can transform arrays or an object into a single validator.
 * This should be your initial entrypoint.
 *
 * @param {object|array} jsonObjectOrArray - Object to be transformed.
 * @returns {yup.Validator}
 */
export function transform(jsonObjectOrArray) {
    try {
        if (!Array.isArray(jsonObjectOrArray)) {
            return transformAll([
                // build a custom validator which takes an object as parameter
                // If we don't do this, we'll get back an object of validators
                ['yup.object'],
                ['yup.required'],
                ['yup.shape', jsonObjectOrArray],
            ]);
        }

        // No case here, just return anything else
        return transformAll(jsonObjectOrArray);
    } catch (error) {
        if (error instanceof ValidationError) {
            throw new Error(
                'Could not validate ' +
                    JSON.stringify(jsonObjectOrArray, null, 4) +
                    `\n${error.message}`,
            );
        }

        throw error;
    }
}
