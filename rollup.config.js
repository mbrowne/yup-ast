import pkg from './package.json'

export default {
    input: 'source/index.js',
    output: [
        {
            file: './dist/' + pkg.main,
            format: 'cjs',
            sourcemap: true,
        }
    ],
    external: ['yup']
}