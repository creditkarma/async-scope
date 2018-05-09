import { expect } from 'code'
import * as Lab from 'lab'

import { IAsyncMap } from '../../main/types'
import * as Utils from '../../main/utils'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('Utils', () => {
    describe('destroyNode', () => {
        it('should remove node and cleanup parents', async () => {
            const mockMap: IAsyncMap = {
                size: 7,
                oldestId: 0,
                0: {
                    id: 0,
                    timestamp: 0,
                    nextId: -1,
                    parentId: null,
                    exited: false,
                    data: {},
                    children: [ 1, 3 ],
                },
                1: {
                    id: 1,
                    timestamp: 0,
                    nextId: 0,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [ 2, 5 ],
                },
                2: {
                    id: 2,
                    timestamp: 0,
                    nextId: 1,
                    parentId: 1,
                    exited: false,
                    data: {},
                    children: [ 4 ],
                },
                3: {
                    id: 3,
                    timestamp: 0,
                    nextId: 2,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [],
                },
                4: {
                    id: 4,
                    timestamp: 0,
                    nextId: 3,
                    parentId: 2,
                    exited: false,
                    data: {},
                    children: [],
                },
                5: {
                    id: 5,
                    timestamp: 0,
                    nextId: 4,
                    parentId: 1,
                    exited: false,
                    data: {},
                    children: [ 6 ],
                },
                6: {
                    id: 6,
                    timestamp: 0,
                    nextId: 5,
                    parentId: 5,
                    exited: false,
                    data: {},
                    children: [],
                },
            }

            Utils.destroyNode(5, mockMap)

            expect<IAsyncMap>(mockMap).to.equal({
                size: 7,
                oldestId: 0,
                0: {
                    id: 0,
                    timestamp: 0,
                    nextId: -1,
                    parentId: null,
                    exited: false,
                    data: {},
                    children: [ 1, 3 ],
                },
                1: {
                    id: 1,
                    timestamp: 0,
                    nextId: 0,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [ 2, 5 ],
                },
                2: {
                    id: 2,
                    timestamp: 0,
                    nextId: 1,
                    parentId: 1,
                    exited: false,
                    data: {},
                    children: [ 4 ],
                },
                3: {
                    id: 3,
                    timestamp: 0,
                    nextId: 2,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [],
                },
                4: {
                    id: 4,
                    timestamp: 0,
                    nextId: 3,
                    parentId: 2,
                    exited: false,
                    data: {},
                    children: [],
                },
                5: {
                    id: 5,
                    timestamp: 0,
                    nextId: 4,
                    parentId: 1,
                    exited: true,
                    data: {},
                    children: [ 6 ],
                },
                6: {
                    id: 6,
                    timestamp: 0,
                    nextId: 5,
                    parentId: 5,
                    exited: false,
                    data: {},
                    children: [],
                },
            })

            Utils.destroyNode(6, mockMap)

            expect<IAsyncMap>(mockMap).to.equal({
                size: 5,
                oldestId: 0,
                0: {
                    id: 0,
                    timestamp: 0,
                    nextId: -1,
                    parentId: null,
                    exited: false,
                    data: {},
                    children: [ 1, 3 ],
                },
                1: {
                    id: 1,
                    timestamp: 0,
                    nextId: 0,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [ 2 ],
                },
                2: {
                    id: 2,
                    timestamp: 0,
                    nextId: 1,
                    parentId: 1,
                    exited: false,
                    data: {},
                    children: [ 4 ],
                },
                3: {
                    id: 3,
                    timestamp: 0,
                    nextId: 2,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [],
                },
                4: {
                    id: 4,
                    timestamp: 0,
                    nextId: 3,
                    parentId: 2,
                    exited: false,
                    data: {},
                    children: [],
                },
            })

            Utils.destroyNode(1, mockMap)

            expect<IAsyncMap>(mockMap).to.equal({
                size: 5,
                oldestId: 0,
                0: {
                    id: 0,
                    timestamp: 0,
                    nextId: -1,
                    parentId: null,
                    exited: false,
                    data: {},
                    children: [ 1, 3 ],
                },
                1: {
                    id: 1,
                    timestamp: 0,
                    nextId: 0,
                    parentId: 0,
                    exited: true,
                    data: {},
                    children: [ 2 ],
                },
                2: {
                    id: 2,
                    timestamp: 0,
                    nextId: 1,
                    parentId: 1,
                    exited: false,
                    data: {},
                    children: [ 4 ],
                },
                3: {
                    id: 3,
                    timestamp: 0,
                    nextId: 2,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [],
                },
                4: {
                    id: 4,
                    timestamp: 0,
                    nextId: 3,
                    parentId: 2,
                    exited: false,
                    data: {},
                    children: [],
                },
            })

            Utils.destroyNode(2, mockMap)

            expect<IAsyncMap>(mockMap).to.equal({
                size: 5,
                oldestId: 0,
                0: {
                    id: 0,
                    timestamp: 0,
                    nextId: -1,
                    parentId: null,
                    exited: false,
                    data: {},
                    children: [ 1, 3 ],
                },
                1: {
                    id: 1,
                    timestamp: 0,
                    nextId: 0,
                    parentId: 0,
                    exited: true,
                    data: {},
                    children: [ 2 ],
                },
                2: {
                    id: 2,
                    timestamp: 0,
                    nextId: 1,
                    parentId: 1,
                    exited: true,
                    data: {},
                    children: [ 4 ],
                },
                3: {
                    id: 3,
                    timestamp: 0,
                    nextId: 2,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [],
                },
                4: {
                    id: 4,
                    timestamp: 0,
                    nextId: 3,
                    parentId: 2,
                    exited: false,
                    data: {},
                    children: [],
                },
            })

            Utils.destroyNode(4, mockMap)

            expect<IAsyncMap>(mockMap).to.equal({
                size: 2,
                oldestId: 0,
                0: {
                    id: 0,
                    timestamp: 0,
                    nextId: -1,
                    parentId: null,
                    exited: false,
                    data: {},
                    children: [ 3 ],
                },
                3: {
                    id: 3,
                    timestamp: 0,
                    nextId: 2,
                    parentId: 0,
                    exited: false,
                    data: {},
                    children: [],
                },
            })

            Utils.destroyNode(3, mockMap)

            expect<IAsyncMap>(mockMap).to.equal({
                size: 1,
                oldestId: 0,
                0: {
                    id: 0,
                    timestamp: 0,
                    nextId: -1,
                    parentId: null,
                    exited: false,
                    data: {},
                    children: [],
                },
            })
        })
    })
})
