import {
    IAsyncMap,
    IAsyncNode,
} from './types'

// DATA UTILITIES

export function recursiveGet<T>(key: string, asyncId: number, asyncMap: IAsyncMap): T | null {
    const asyncNode: IAsyncNode | undefined = asyncMap[asyncId]
    if (asyncNode !== undefined) {
        if (asyncNode.data !== undefined && asyncNode.data[key] !== undefined) {
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

        if (asyncNode.data !== undefined && asyncNode.data[key] !== undefined) {
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

// NODE UTILITIES

export function cleanUpParents(asyncId: number, parentId: number, asyncMap: IAsyncMap): void {
    let parentNode: IAsyncNode | undefined = asyncMap[parentId]
    while (parentNode !== undefined) {
        const indexToDelete: number = parentNode.children.indexOf(asyncId)
        if (indexToDelete > -1) {
            parentNode.children.splice(indexToDelete, 1)
        }

        if (parentNode.exited && parentNode.children.length === 0) {
            delete asyncMap[parentId]
            asyncMap.size = (asyncMap.size - 1)

            const nextId = parentNode.nextId
            const previousId = parentNode.previousId

            const nextNode = asyncMap[nextId]
            const previousNode = asyncMap[previousId]

            if (previousNode !== undefined) {
                previousNode.nextId = parentNode.nextId
            }

            if (nextNode !== undefined) {
                nextNode.previousId = previousId
            }

            if (asyncMap.oldestId === parentNode.id) {
                asyncMap.oldestId = nextId
            }

            const nextParentId: number | null = parentNode.parentId

            if (nextParentId !== null) {
                asyncId = parentId
                parentId = nextParentId
                parentNode = asyncMap[nextParentId]
                continue
            }
        }

        parentNode = undefined
    }
}

export function removeOldest(asyncMap: IAsyncMap): void {
    const oldestId: number = asyncMap.oldestId
    const nodeToDelete: IAsyncNode | undefined = asyncMap[oldestId]
    if (nodeToDelete !== undefined) {
        delete asyncMap[asyncMap.oldestId]
        asyncMap.size = (asyncMap.size - 1)

        const previousId: number = nodeToDelete.previousId
        const nextId: number = nodeToDelete.nextId
        const nextNode: IAsyncNode | undefined = asyncMap[nextId]

        if (nextNode !== undefined) {
            nextNode.previousId = previousId
        }

        asyncMap.oldestId = nextId

        for (const childId of nodeToDelete.children) {
            const childNode: IAsyncNode | undefined = asyncMap[childId]
            if (childNode !== undefined) {
                childNode.parentId = null
            }
        }
    } else if (oldestId > -1) {
        asyncMap.oldestId = parseInt(Object.keys(asyncMap).sort()[0], 10)
    }
}

export function destroyNode(asyncId: number, asyncMap: IAsyncMap): void {
    const nodeToDestroy: IAsyncNode | undefined = asyncMap[asyncId]

    if (nodeToDestroy !== undefined) {
        // Only delete if the the child scopes are not still active
        if (nodeToDestroy.children.length === 0) {
            delete asyncMap[asyncId]
            asyncMap.size = (asyncMap.size - 1)

            const nextId = nodeToDestroy.nextId
            const previousId = nodeToDestroy.previousId

            const nextNode = asyncMap[nextId]
            const previousNode = asyncMap[previousId]

            if (previousNode !== undefined) {
                previousNode.nextId = nodeToDestroy.nextId
            }

            if (nextNode !== undefined) {
                nextNode.previousId = previousId
            }

            if (nodeToDestroy.id === asyncMap.oldestId) {
                asyncMap.oldestId = nextId
            }

            const parentId: number | null = nodeToDestroy.parentId

            if (parentId !== null) {
                cleanUpParents(asyncId, parentId, asyncMap)
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
