#!/usr/bin/env node
import * as program from 'commander'
import * as fs from 'fs-extra'
import * as gbasm from 'hgbasm'
import * as pathUtil from 'path'

const rootFolder: string = process.cwd()
const includeFolders: string[] = []
let sourcePath: string = ''

program
    // tslint:disable-next-line: no-var-requires
    .version(require('./package.json').version)
    .arguments('<sourcefile>')
    .action((sourcefile) => {
        sourcePath = sourcefile
    })
    .option('-b, --binary <chars>', 'Change the two characters used for binary constants. The defaults are 01. Not yet supported.')
    .option('-D, --debug <name>[=value]', 'Add string symbol to the compiled source code. This is equivalent to name EQUS “value” in code. If a value is not specified, a value of 1 is given.')
    .option('-E, --export', 'Export all labels, including unreferenced and local labels.')
    .option('-g, --gbgfx <chars>', 'Change the four characters used for gbgfx constants. The defaults are 0123. Not yet supported.')
    .option('-h, --no-halt-nop', 'By default, gbasm inserts a ‘nop’ instruction immediately after any ‘halt’ instruction. The -h option disables this behavior.')
    .option('-i, --include <path>', 'Add an include path.', (arg) => includeFolders.push(arg))
    .option('-L, --no-ld-ldh', 'Disable the optimization that turns loads of the form LD [$FF00+n8],A into the opcode LDH [$FF00+n8],A in order to have full control of the result in the final ROM.')
    .option('-M, --depfile <dependfile>', 'Print make(1) dependencies to dependfile.')
    .option('-o, --out <outfile>', 'Write an object file to the given filename.')
    .option('-p, --pad <pad_value>', 'When padding an image, pad with this value. The default is 0x00.')
    .option('-v, --verbose', 'Be verbose.')
    .option('-w, --nowarn', 'Disable warning output.')
    .parse(process.argv)

if (!sourcePath) {
    console.error('No source file specified, exiting')
    process.exit(-1)
}

async function run(): Promise<void> {
    const logger = new gbasm.Logger({
        log: (msg, type) => {
            if (type === 'error' || type === 'fatal') {
                process.stderr.write(msg)
            } else {
                process.stdout.write(msg)
            }
        },
        allowAnsi: true
    }, program.verbose ? 'trace' : 'info')
    try {
        const asmFile = new gbasm.AsmFile(pathUtil.relative(rootFolder, sourcePath), fs.readFileSync(sourcePath, 'utf8'))
        logger.log('info', `Assembling ${asmFile.path}\n`)

        const provider: gbasm.IFileProvider = {
            retrieve: async (path, sender, binary) => {
                try {
                    const filePath = pathUtil.resolve(rootFolder, path)
                    const file = await fs.readFile(filePath, binary ? 'binary' : 'utf8')
                    return new gbasm.AsmFile(pathUtil.relative(rootFolder, filePath), file)
                } catch (_) {
                    // file does not exist or could not be accessed; continue
                }
                try {
                    const filePath = pathUtil.resolve(pathUtil.dirname(sender.path), path)
                    const file = await fs.readFile(filePath, binary ? 'binary' : 'utf8')
                    return new gbasm.AsmFile(pathUtil.relative(rootFolder, filePath), file)
                } catch (_) {
                    // file does not exist or could not be accessed; continue
                }
                try {
                    const filePath = pathUtil.resolve(pathUtil.dirname(sourcePath), path)
                    const file = await fs.readFile(filePath, binary ? 'binary' : 'utf8')
                    return new gbasm.AsmFile(pathUtil.relative(rootFolder, filePath), file)
                } catch (_) {
                    // file does not exist or could not be accessed; continue
                }
                for (const incPath of includeFolders) {
                    try {
                        const filePath = pathUtil.resolve(incPath, path)
                        const file = await fs.readFile(filePath, binary ? 'binary' : 'utf8')
                        return new gbasm.AsmFile(pathUtil.relative(rootFolder, filePath), file)
                    } catch (_) {
                        // file does not exist or could not be accessed; continue
                    }
                }
                return null
            }
        }

        let debugName: string = program.debug !== undefined ? program.debug : ''
        let debugValue: string = '1'
        if (debugName && debugName.includes('=')) {
            const bits = debugName.split('=')
            debugName = bits[0]
            debugValue = bits[1]
        }

        const asm = new gbasm.Assembler(logger)

        const result = await asm.assemble(new gbasm.AssemblerContext(asm, {
            padding: program.padding !== undefined ? program.padding : 0x00,
            exportAllLabels: program.export !== undefined ? program.export : false,
            nopAfterHalt: program.haltNop !== undefined ? program.haltNop : true,
            optimizeLd: program.ldLdh !== undefined ? program.ldLdh : true,
            debugDefineName: debugName,
            debugDefineValue: debugValue
        }, new gbasm.FileContext(asmFile), provider))

        if (program.depfile) {
            if (program.out) {
                const deps = result.dependencies
                deps.unshift(pathUtil.relative(rootFolder, sourcePath))
                const lines = deps.map((d) => `${pathUtil.relative(rootFolder, program.out)}: ${d}`)
                fs.writeFileSync(program.depfile, lines.join('\n'))
            } else {
                logger.log('fatal', 'Cannot generate a dependency file without an object file path\n')
                process.exit(-1)
            }
        }

        if (program.out && !result.diagnostics.some((d) => d.type === 'error')) {
            fs.writeFileSync(program.out, gbasm.writeObjectFile(result.objectFile))
        }

        for (const diag of result.diagnostics.filter((d) => d.type === 'info')) {
            logger.log('info', `${diag}\n`)
        }

        if (!program.nowarn) {
            for (const diag of result.diagnostics.filter((d) => d.type === 'warn')) {
                logger.log('warn', `${diag}\n`)
            }
        }

        for (const diag of result.diagnostics.filter((d) => d.type === 'error')) {
            logger.log('error', `${diag}\n`)
        }

        const errorCount = result.diagnostics.filter((diag) => diag.type === 'error').length
        const warnCount = result.diagnostics.filter((diag) => diag.type === 'warn').length

        logger.log('info', `Assembly of ${asmFile.path} ${errorCount ? 'failed' : 'finished'} with ${errorCount} ${errorCount === 1 ? 'error' : 'errors'} and ${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'}\n`)

        if (errorCount > 0) {
            process.exit(-1)
        }
    } catch (err) {
        logger.log('fatal', `A fatal error occurred during assembly.\n${err.stack}\n`)
        process.exit(-1)
    }
    process.exit(0)
}

run()
