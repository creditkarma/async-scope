import {
    IAsyncMap,
    IAsyncNode,
} from './types'

export function cleanUpParents(asyncId: number, parentId: number, asyncMap: IAsyncMap): void {
    let asyncNode: IAsyncNode | undefined = asyncMap[parentId]
    while (asyncNode !== undefined) {
        const newChildren: Array<number> = []

        for (const next of asyncNode.children) {
            if (next !== asyncId) {
                newChildren.push(next)
            }
        }

        asyncNode.children = newChildren

        if (asyncNode.exited && asyncNode.children.length === 0) {
            const nextParentId: number | null = asyncNode.parentId
            delete asyncMap[parentId]

            if (nextParentId !== null) {
                asyncId = parentId
                parentId = nextParentId
                asyncNode = asyncMap[nextParentId]
                continue
            }
        }

        asyncNode = undefined
    }
}

export function recursiveGet<T>(key: string, asyncId: number, asyncMap: IAsyncMap): T | null {
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

export function recursiveDelete(key: string, asyncId: number, asyncMap: IAsyncMap): void {
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

export function lineageFor(asyncId: number, asyncMap: IAsyncMap): Array<number> {
    const asyncNode: IAsyncNode | undefined = asyncMap[asyncId]
    if (asyncNode !== undefined) {
        const parentId: number | null = asyncNode.parentId

        if (parentId !== null) {
            return [ asyncId, ...lineageFor(parentId, asyncMap) ]

        } else {
            return [ asyncId ]
        }
    }

    return []
}

export function destroyNode(asyncId: number, asyncMap: IAsyncMap): void {
    const nodeToDestroy: IAsyncNode | undefined = asyncMap[asyncId]

    if (nodeToDestroy !== undefined) {
        // Only delete if the the child scopes are not still active
        if (nodeToDestroy.children.length === 0) {
            const parentId: number | null = nodeToDestroy.parentId
            if (parentId !== null) {
                delete asyncMap[asyncId]

                if (nodeToDestroy.id === asyncMap.oldestId) {
                    asyncMap.oldestId = nodeToDestroy.nextId
                }

                cleanUpParents(asyncId, parentId, asyncMap)
                asyncMap.size = (Object.keys(asyncMap).length - 2)
            }

        // If child scopes are still active mark this scope as exited so we can clean up
        // when child scopes do exit.
        } else {
            nodeToDestroy.exited = true
        }
    }
}

export function runPurge(asyncMap: IAsyncMap, currentTime: number, ttl: number): void {
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
            destroyNode(element.id, asyncMap)
        }

        toPurge.length = 0
    }
}
