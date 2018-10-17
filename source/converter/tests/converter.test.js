import * as yup from 'yup';
import yupPrinter from 'yup/lib/util/printValue';

import { convertJsonToYup, transformAll } from '..';

describe('correctly walks a schema object', () => {
    it('walks arrays', () => {
        const result = transformAll([['yup.object'], ['yup.shape']]);

        expect(result).toBeInstanceOf(yup.object);
        expect(result.isValidSync({})).toEqual(true);
        expect(result.isValidSync(5)).toEqual(false);
    });

    it('walks arrays with objects', () => {
        const result = transformAll([
            ['yup.object'],
            ['yup.shape', { test: [['yup.number'], ['yup.required'], ['yup.max', 500]] }],
            ['yup.required'],
        ]);

        expect(result.isValidSync({})).toEqual(false);
        expect(result.isValidSync({ test: 5 })).toEqual(true);
        expect(result.isValidSync({ test: 501 })).toEqual(false);
    });

    it('walks arrays with objects containing multiple items', () => {
        const result = transformAll([
            ['yup.object'],
            [
                'yup.shape',
                {
                    test: [['yup.number'], ['yup.required'], ['yup.max', 500]],
                    name: [['yup.string'], ['yup.required'], ['yup.min', 4], ['yup.max', 12]],
                },
            ],
            ['yup.required'],
        ]);

        expect(result.isValidSync({})).toEqual(false);
        expect(result.isValidSync({ test: 5 })).toEqual(false);
        expect(result.isValidSync({ test: 501 })).toEqual(false);

        expect(result.isValidSync({ test: 500, name: '1234' })).toEqual(true);
        expect(result.isValidSync({ test: 500, name: '123' })).toEqual(false);
        expect(result.isValidSync({ test: 500, name: '123456789012' })).toEqual(true);
        expect(result.isValidSync({ test: 500, name: '1234567890123' })).toEqual(false);
    });
});

const numberTests = [
    {
        name: 'Converts simple yup type (Number)',
        input: [['yup.number']],
        output: yup.number(),
        validates: {
            // prettier-no-wrap
            success: [1],
            failure: ['A'],
        },
    },
    {
        name: 'Converts simple type with required (Number)',
        input: [['yup.number'], ['yup.required']],
        output: yup.number().required(),
        validates: {
            // prettier-no-wrap
            success: [1],
            failure: [],
        },
    },
    {
        name: 'Converts simple type with required chains (Number) (1/2)',
        input: [['yup.number'], ['yup.required'], ['yup.min', 50]],
        validates: {
            // prettier-no-wrap
            success: [50],
            failure: [],
        },
    },
    {
        name: 'Converts simple type with required chains (Number) (2/2)',
        input: [['yup.number'], ['yup.required'], ['yup.min', 50], ['yup.max', 500]],
        validates: {
            // prettier-no-wrap
            success: [50, 51, 499, 500],
            failure: [1, 2, 3, 4, 501, 502, 503],
        },
    },
];

const stringTests = [
    {
        name: 'Converts simple yup type (String)',
        input: [['yup.string']],
        validates: {
            // prettier-no-wrap
            success: ['A', 'ABC', 'ABC123', 1],
            failure: [null],
        },
    },
    {
        name: 'Converts simple type with required (String)',
        input: [['yup.string'], ['yup.required']],
        validates: {
            // prettier-no-wrap
            success: ['A', 'ABC', 'ABC123'],
            failure: [null],
        },
    },
    {
        name: 'Converts simple type with required chains (String) (1/2)',
        input: [['yup.string'], ['yup.required'], ['yup.min', 10]],
        validates: {
            // prettier-no-wrap
            success: ['1234567890', '123456789000000'],
            failure: ['123', 'abc'],
        },
    },
    {
        name: 'Converts simple type with required chains (String) (2/2)',
        input: [['yup.string'], ['yup.required'], ['yup.min', 10], ['yup.max', 12]],
        validates: {
            // prettier-no-wrap
            success: ['1234567890', '12345678901', '123456789012'],
            failure: ['1234567890123', '12345678901234'],
        },
    },
];

const objectTests = [
    {
        name: 'Creates a simple object',
        input: [['yup.object']],
        validates: {
            // prettier-no-wrap
            success: [{}],
            failure: ['123', 'abc'],
        },
    },
    {
        name: 'Creates a simple object shape',
        input: [['yup.object'], ['yup.shape', {}]],
        validates: {
            // prettier-no-wrap
            success: [{}],
            failure: ['123', 'abc'],
        },
    },
    {
        name: 'Creates a nested object shape',
        input: [['yup.object'], ['yup.shape', { test: [['yup.object'], ['yup.shape', {}], ['yup.required']] }]],
        validates: {
            // prettier-no-wrap
            success: [{ test: {} }],
            failure: [{}, { test: [['yup.object'], ['yup.shape', {}]] }],
        },
    },
    {
        name: 'Allows non-required object fields',
        input: [['yup.object'], ['yup.shape', { test: [['yup.object'], ['yup.shape', {}]] }]],
        validates: {
            // prettier-no-wrap
            success: [{ test: {} }, {}],
            failure: [{ test: [['yup.object'], ['yup.shape', {}]] }],
        },
    },
];

describe('correctly transforms data from JSON to YUP', () => {
    describe('number tests', () => {
        numberTests.forEach(({ name, input, validates: { success = [], failure = [] } }) => {
            it(name, () => {
                const generatedValidator = convertJsonToYup(input);

                success.forEach(item => expect(generatedValidator.isValidSync(item)).toEqual(true));
                failure.forEach(item => expect(generatedValidator.isValidSync(item)).toEqual(false));
            });
        });
    });

    describe('string tests', () => {
        stringTests.forEach(({ name, input, validates: { success = [], failure = [] } }) => {
            it(name, () => {
                const generatedValidator = convertJsonToYup(input);

                success.forEach(item => expect(generatedValidator.isValidSync(item)).toEqual(true));
                failure.forEach(item => expect(generatedValidator.isValidSync(item)).toEqual(false));
            });
        });
    });

    describe('object tests', () => {
        objectTests.forEach(({ name, input, validates: { success = [], failure = [] } }) => {
            it(name, () => {
                const generatedValidator = convertJsonToYup(input);

                success.forEach(item => expect(generatedValidator.isValidSync(item)).toEqual(true));
                failure.forEach(item => expect(generatedValidator.isValidSync(item)).toEqual(false));
            });
        });
    });

    it('handles more complex object schema', () => {
        const validator = convertJsonToYup([
            [
                'yup.object.shape',
                {
                    title: [
                        [
                            'yup.object.shape',
                            {
                                en: [
                                    ['yup.string'],
                                    ['yup.required'],
                                    ['yup.min', 5, 'String must be at least 5 characters'],
                                    ['yup.max', 50, 'String must be at most 50 characters'],
                                ],
                                ru: [
                                    ['yup.string'],
                                    ['yup.required'],
                                    ['yup.min', 5, 'String must be at least 5 characters'],
                                    ['yup.max', 50, 'String must be at most 50 characters'],
                                ],
                            },
                        ],
                        ['yup.required'],
                    ],
                    value: [['yup.number'], ['yup.required'], ['yup.min', 5]],
                },
            ],
        ]);

        expect(validator.isValidSync({ title: { en: '12345', ru: '12345' }, value: 5 })).toEqual(true);
        expect(validator.isValidSync({ title: { en: '12345', ru: '12345' } })).toEqual(false);
        expect(validator.isValidSync({ title: { ru: '12345' }, value: 5 })).toEqual(false);
        expect(validator.isValidSync({ title: { en: '12345' }, value: 5 })).toEqual(false);
        expect(validator.isValidSync({ title: { en: '12345', ru: '12345' } })).toEqual(false);
        expect(validator.isValidSync()).toEqual(false);
    });

    // it('handles objects of objects', () => {
    //     setDebug();
    //     const validator = convertJsonToYup([
    //         [
    //             'yup.object.shape',
    //             {
    //                 test: [
    //                     'yup.object.shape',
    //                     {
    //                         title: [
    //                             ['yup.string'],
    //                             ['yup.required'],
    //                             ['yup.max', 7, 'String must be at most 8 characters'],
    //                             ['yup.min', 5, 'String must be at least 5 characters'],
    //                         ],
    //                     },
    //                 ],
    //             },
    //         ],
    //         ['yup.required'],
    //     ]);

    //     // console.log(
    //     //     yup.array().of(
    //     //         yup.object().shape({
    //     //             title: yup.object().shape({
    //     //                 en: yup.string().required(),
    //     //                 ru: yup.string().required(),
    //     //             }),
    //     //         })
    //     //     )
    //     // );

    //     console.log(validator);

    //     expect(validator.isValidSync({ test: { title: '12345' } })).toEqual(true);
    //     expect(validator.isValidSync({ test: { title: '12345678' } })).toEqual(true);
    //     expect(validator.isValidSync({ test: { title: '1234' } })).toEqual(false);
    //     expect(validator.isValidSync({ test: {} })).toEqual(false);
    //     expect(validator.isValidSync()).toEqual(false);
    // });
});
