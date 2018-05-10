import { IAsyncHook, IAsyncHooks, IHookCallbacks } from '@creditkarma/async-hooks'
import { expect } from 'code'
import * as Lab from 'lab'

import { AsyncScope } from '../../main/'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

class MockHook implements IAsyncHook {
    public enable() {
        return this
    }
    public disable() {
        return this
    }
}

class MockAsyncContext {
    private callbacks: IHookCallbacks | null = null
    private currentId: number = 0
    private triggerId: number = 0

    public addNode(id: number, parentId: number): void {
        if (this.callbacks !== null) {
            this.callbacks.init!(id, 'foo', parentId, {})
        }
    }

    public deleteNode(id: number): void {
        if (this.callbacks !== null) {
            this.callbacks.destroy!(id)
        }
    }

    public setId(id: number): void {
        this.currentId = id
    }

    public getMockHooks(): IAsyncHooks {
        return {
            createHook: (callbacks: IHookCallbacks): IAsyncHook => {
                this.callbacks = callbacks
                return new MockHook()
            },

            executionAsyncId: () => {
                return this.currentId
            },

            currentId: () => {
                return this.currentId
            },

            triggerAsyncId: () => {
                return this.triggerId
            },

            triggerId: () => {
                return this.triggerId
            },
        }
    }
}

describe('AsyncScope', () => {
    it('should eject nodes when max size is reached', async () => {
        const mockContext: MockAsyncContext = new MockAsyncContext()
        const asyncScope = new AsyncScope({
            maxSize: 10,
            asyncHooks: mockContext.getMockHooks(),
        })

        mockContext.addNode(1, 0)
        mockContext.addNode(2, 0)
        mockContext.addNode(3, 1)
        mockContext.addNode(4, 3)
        mockContext.addNode(5, 2)
        mockContext.addNode(6, 0)
        mockContext.addNode(7, 4)
        mockContext.addNode(8, 3)
        mockContext.addNode(9, 1)

        mockContext.setId(9)
        expect<Array<number>>(asyncScope.lineage()).to.equal([ 9, 1, 0 ])

        mockContext.setId(8)
        expect<Array<number>>(asyncScope.lineage()).to.equal([ 8, 3, 1, 0 ])

        mockContext.setId(7)
        expect<Array<number>>(asyncScope.lineage()).to.equal([ 7, 4, 3, 1, 0 ])

        mockContext.addNode(10, 1) // eject 1

        mockContext.setId(10)
        expect<Array<number>>(asyncScope.lineage()).to.equal([ 10 ])

        mockContext.setId(7)
        expect<Array<number>>(asyncScope.lineage()).to.equal([ 7, 4, 3 ])

        mockContext.setId(5)
        expect<Array<number>>(asyncScope.lineage()).to.equal([ 5, 2, 0 ])

        mockContext.addNode(11, 2) // eject 2
        mockContext.addNode(12, 7) // eject 3

        mockContext.setId(12)
        expect<Array<number>>(asyncScope.lineage()).to.equal([ 12, 7, 4 ])

        mockContext.setId(5)
        expect<Array<number>>(asyncScope.lineage()).to.equal([ 5 ])
    })

    it('should correctly profile size', async () => {
        const mockContext: MockAsyncContext = new MockAsyncContext()
        const asyncScope = new AsyncScope({
            maxSize: 10,
            asyncHooks: mockContext.getMockHooks(),
        })

        expect(asyncScope.size()).to.equal({ size: 0, maxSize: 10 })

        mockContext.addNode(1, 0)
        mockContext.addNode(2, 0)
        mockContext.addNode(3, 1)
        mockContext.addNode(4, 3)
        mockContext.addNode(5, 2)
        mockContext.addNode(6, 0)
        mockContext.addNode(7, 4)
        mockContext.addNode(8, 3)
        mockContext.addNode(9, 1)

        expect(asyncScope.size()).to.equal({ size: 10, maxSize: 10 })

        mockContext.addNode(10, 1) // eject 1
        mockContext.addNode(11, 2) // eject 2
        mockContext.addNode(12, 7) // eject 3

        expect(asyncScope.size()).to.equal({ size: 10, maxSize: 10 })
    })
})
