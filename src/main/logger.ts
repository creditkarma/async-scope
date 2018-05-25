import { debug } from '@creditkarma/async-hooks'

export const log = (msg: string, data?: any) => {
    if (data !== undefined && process.env.DEBUG !== undefined) {
        debug.info(`[async-scope:info] ${msg}`, data)
    } else if (process.env.DUBUG !== undefined) {
        debug.info(`[async-scope:info] ${msg}`)
    }
}

export const warn = (msg: string, data?: any) => {
    if (data !== undefined) {
        debug.info(`[async-scope:warn] ${msg}`, data)
    } else {
        debug.info(`[async-scope:warn] ${msg}`)
    }
}

export const error = (msg: string, data?: any) => {
    if (data !== undefined) {
        debug.error(`[async-scope:error] ${msg}`, data)
    } else {
        debug.error(`[async-scope:error] ${msg}`)
    }
}
