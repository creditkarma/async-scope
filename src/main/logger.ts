import { debug } from '@creditkarma/async-hooks'

export const log = (msg: string, data?: any) => {
    if (data !== undefined && process.env.DEBUG !== undefined) {
        debug(`[thrift-client:info] ${msg}`, data)
    } else if (process.env.DUBUG !== undefined) {
        debug(`[thrift-client:info] ${msg}`)
    }
}

export const warn = (msg: string, data?: any) => {
    if (data !== undefined) {
        debug(`[thrift-client:warn] ${msg}`, data)
    } else {
        debug(`[thrift-client:warn] ${msg}`)
    }
}

export const error = (msg: string, data?: any) => {
    if (data !== undefined) {
        debug(`[thrift-client:error] ${msg}`, data)
    } else {
        debug(`[thrift-client:error] ${msg}`)
    }
}
