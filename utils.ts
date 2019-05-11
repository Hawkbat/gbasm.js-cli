import IVersion from 'hgbasm/lib/IVersion'

export function getHgbasmVersion(): IVersion {
    const str: string = require('./node_modules/hgbasm/package.json').version
    const bits = str.split('.')
    return {
        major: parseInt(bits[0]),
        minor: parseInt(bits[1]),
        patch: parseInt(bits[2])
    }
}
