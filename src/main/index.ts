import * as AsyncHooks from '@creditkarma/async-hooks'

export interface IAsyncScope {
    get<T>(key: string): T | null
    set<T>(key: string, value: T): void
    delete(key: string): void
}

export interface IAsyncOptions {
    nodeExpiration?: number
    purgeInterval?: number
}

interface IDictionary {
    [key: string]: any
}

interface IAsyncNode {
    id: number
    timestamp: number
    parentId: number | null
    exited: boolean
    data: IDictionary
    children: Array<number>
}

interface IAsyncMap {
    [asyncId: number]: IAsyncNode
}

// Data has a ten minute expiration
const NODE_EXPIRATION: number = (1000 * 60 * 10)

// Purge data every 5 minutes
const PURGE_INTERVAL: number = (1000 * 60 * 5)

function cleanUpParents(asyncId: number, parentId: number, asyncMap: IAsyncMap): void {
    const asyncNode: IAsyncNode | undefined = asyncMap[parentId]
    if (asyncNode !== undefined) {
        const newChildren: Array<number> = []

        for (const next of asyncNode.children) {
            if (next !== asyncId) {
                newChildren.push(next)
            }
        }

        asyncNode.children = newChildren

        if (asyncNode.exited && asyncNode.children.length === 0) {
            const nextParentId: number | null = asyncNode.parentId
            if (nextParentId !== null) {
                delete asyncMap[parentId]
                cleanUpParents(parentId, nextParentId, asyncMap)
            }
        }
    }
}

function recursiveGet<T>(key: string, asyncId: number, asyncMap: IAsyncMap): T | null {
    const asyncNode: IAsyncNode | undefined = asyncMap[asyncId]
    if (asyncNode !== undefined) {
        if (asyncNode.data[key] !== undefined) {
            return asyncNode.data[key]

        } else {
            const parentId: number | null = asyncNode.parentId
            if (parentId !== null) {
                return recursiveGet<T>(key, parentId, asyncMap)
            } else {
                return null
            }
        }
    } else {
        return null
    }
}

function recursiveDelete(key: string, asyncId: number, asyncMap: IAsyncMap): void {
    const asyncNode: IAsyncNode | undefined = asyncMap[asyncId]
    if (asyncNode !== undefined) {
        const parentId: number | null = asyncNode.parentId

        if (asyncNode.data[key] !== undefined) {
            asyncNode.data[key] = undefined
        }

        if (parentId !== null) {
            recursiveDelete(key, parentId, asyncMap)
        }
    }
}

function lineageFor(asyncId: number, asyncMap: IAsyncMap): Array<number> {
    const asyncNode: IAsyncNode | undefined = asyncMap[asyncId]
    if (asyncNode !== undefined) {
        const parentId: number | null = asyncNode.parentId

        if (parentId !== null) {
            return [ asyncId, ...lineageFor(parentId, asyncMap) ]
        }
    }

    return [ asyncId ]
}

function destroyNode(asyncId: number, nodeToDestroy: IAsyncNode, asyncMap: IAsyncMap): void {
    // Only delete if the the child scopes are not still active
    if (nodeToDestroy.children.length === 0) {
        const parentId: number | null = nodeToDestroy.parentId
        if (parentId !== null) {
            delete asyncMap[asyncId]
            cleanUpParents(asyncId, parentId, asyncMap)
        }

    // If child scopes are still active mark this scope as exited so we can clean up
    // when child scopes do exit.
    } else {
        nodeToDestroy.exited = true
    }
}

function runPurge(asyncMap: IAsyncMap, currentTime: number, ttl: number): void {
    if (ttl > 0) {
        const toPurge: Array<IAsyncNode> = []

        for (const key in asyncMap) {
            if (asyncMap.hasOwnProperty(key)) {
                const element = asyncMap[key]
                if ((currentTime - element.timestamp) > ttl) {
                    toPurge.push(element)
                }
            }
        }

        for (const element of toPurge) {
            destroyNode(element.id, element, asyncMap)
        }

        toPurge.length = 0
    }
}

export class AsyncScope implements IAsyncScope {
    public static debug(msg: string, ...args: Array<any>): void {
        AsyncHooks.debug(msg, ...args)
    }

    private asyncMap: IAsyncMap
    private nodeExpiration: number
    private purgeInterval: number
    private lastPurge: number

    constructor({
        nodeExpiration = NODE_EXPIRATION,
        purgeInterval = PURGE_INTERVAL,
    }: IAsyncOptions = {}) {
        const self = this
        this.asyncMap = {}
        this.nodeExpiration = nodeExpiration
        this.purgeInterval = purgeInterval
        this.lastPurge = Date.now()

        AsyncHooks.createHook({
            init(asyncId: number, type: string, triggerAsyncId: number, resource: object) {
                // AsyncScope.debug(`asyncId[${asyncId}], parentId[${triggerAsyncId}]`)
                if (self.asyncMap[triggerAsyncId] === undefined) {
                    self.addNode(triggerAsyncId, null)
                }

                const parentNode: IAsyncNode | undefined = self.asyncMap[triggerAsyncId]

                if (parentNode !== undefined) {
                    parentNode.children.push(asyncId)
                    parentNode.timestamp = Date.now()
                    self.addNode(asyncId, triggerAsyncId)
                }

                self.purge()
            },
            before(asyncId: number) {
                // Nothing to see here
                // AsyncScope.debug(`before[${asyncId}]`)
            },
            after(asyncId: number) {
                // Nothing to see here
                // AsyncScope.debug(`after[${asyncId}]`)
            },
            promiseResolve(asyncId: number) {
                // Nothing to see here
                // AsyncScope.debug(`promiseResolve[${asyncId}]`)
            },
            destroy(asyncId: number) {
                const nodeToDestroy = self.asyncMap[asyncId]
                if (nodeToDestroy !== undefined) {
                    destroyNode(asyncId, nodeToDestroy, self.asyncMap)
                }

                self.purge()
            },
        }).enable()
    }

    public get<T>(key: string): T | null {
        const activeId: number = AsyncHooks.executionAsyncId()
        this.addNode(activeId, null)
        return recursiveGet<T>(key, activeId, this.asyncMap)
    }

    public set<T>(key: string, value: T): void {
        const activeId: number = AsyncHooks.executionAsyncId()
        this.addNode(activeId, null)
        const activeNode: IAsyncNode | undefined = this.asyncMap[activeId]
        if (activeNode !== undefined) {
            activeNode.data[key] = value
        }
    }

    public delete(key: string): void {
        const activeId: number = AsyncHooks.executionAsyncId()
        recursiveDelete(key, activeId, this.asyncMap)
    }

    /**
     * A method for debugging, returns the lineage (parent scope ids) of the current scope
     */
    public lineage(): Array<number> {
        const activeId: number = AsyncHooks.executionAsyncId()
        return lineageFor(activeId, this.asyncMap)
    }

    private addNode(asyncId: number, parentId: number | null): void {
        if (this.asyncMap[asyncId] === undefined) {
            this.asyncMap[asyncId] = {
                id: asyncId,
                timestamp: Date.now(),
                parentId,
                exited: false,
                data: {},
                children: [],
            }
        }
    }

    private purge(): void {
        const currentTime: number = Date.now()
        if ((currentTime - this.lastPurge) > this.purgeInterval) {
            this.lastPurge = currentTime
            runPurge(this.asyncMap, currentTime, this.nodeExpiration)
        }
    }
}

// export const sharedScope: AsyncScope = new AsyncScope()
