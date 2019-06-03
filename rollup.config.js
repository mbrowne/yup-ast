import pkg from './package.json'

export default {
    input: 'source/index.js',
    output: [
        {
            file: './dist/' + pkg.main,
            format: 'cjs',
            sourcemap: true,
        },
        {
            file: './dist/' + pkg.module,
            format: 'esm',
            sourcemap: true,
        }
    ],
    external: ['yup']
}