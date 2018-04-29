export interface IAsyncScope {
    get<T>(key: string): T | null
    set<T>(key: string, value: T): void
    delete(key: string): void
}

export interface IAsyncOptions {
    nodeExpiration?: number
    purgeInterval?: number
}

export interface IDictionary {
    [key: string]: any
}

export interface IAsyncNode {
    id: number
    timestamp: number
    parentId: number | null
    exited: boolean
    data: IDictionary
    children: Array<number>
}

export interface IAsyncMap {
    [asyncId: number]: IAsyncNode
}
