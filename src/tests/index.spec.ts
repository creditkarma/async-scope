import { expect } from 'code'
import * as Lab from 'lab'

import { setTimeout } from 'timers'
import { sharedScope } from '../main/'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('AsyncScope', () => {
    describe('set', () => {
        it('should add value to current execution scope', (done) => {
            sharedScope.set('set_test', 45)
            expect(sharedScope.get<number>('set_test')).to.equal(45)
            done()
        })
    })

    describe('get', () => {
        it('should allow fetching of values set on the same call tree', (done) => {
            setTimeout(() => {
                function childFunction() {
                    expect(sharedScope.get<number>('foo')).to.equal(6)
                    sharedScope.set('bar', 89)
                }

                function parentFunction() {
                    sharedScope.set('foo', 6)
                    setTimeout(() => {
                        childFunction()
                    }, 50)

                    setTimeout(() => {
                        expect(sharedScope.get<number>('bar')).to.equal(null)
                        done()
                    }, 250)
                }

                parentFunction()
            }, 500)
        })

        it('should not allow fetching of values set on different async call trees', (done) => {
            setTimeout(() => { // runs first
                sharedScope.set('boom', 109)

                function childFunction() { // runs fourth
                    expect(sharedScope.get<number>('boo')).to.equal(null)
                }

                function parentFunction() { // runs third
                    sharedScope.set('bam', 98)
                    setTimeout(childFunction, 200)
                }

                parentFunction()
            }, 100)

            setTimeout(() => { // runs second
                sharedScope.set('boo', 37)
                expect(sharedScope.get<number>('boom')).to.equal(null)

                function childFunction() { // runs sixth
                    expect(sharedScope.get<number>('bam')).to.equal(null)
                    done()
                }

                function parentFunction() { // runs fifth
                    setTimeout(childFunction, 200)
                }

                parentFunction()
            }, 200)
        })

        it('should correctly fetch values across multiple sibling async contexts', (done) => {
            const values: Array<number> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            sharedScope.set('all_siblings', 456)
            values.forEach((next: number) => {
                setTimeout(() => {
                    sharedScope.set(`key_${next}`, next)
                    setTimeout(() => {
                        expect(sharedScope.get<number>(`key_${next}`)).to.equal(next)
                        expect(sharedScope.get<number>('all_siblings')).to.equal(456)
                        values.forEach((v) => {
                            if (v !== next) {
                                expect(sharedScope.get<number>(`key_${v}`)).to.equal(null)
                            } else {
                                expect(sharedScope.get<number>(`key_${v}`)).to.equal(next)
                            }
                        })

                        if (next === 10) {
                            done()
                        }
                    }, (200 + (next * 200)))
                }, (200 - (next * 18)))
            })
        })
    })

    describe('delete', () => {
        it('should delete an existing value from the store', (done) => {
            sharedScope.set('delete_test', 67)
            expect(sharedScope.get<number>('delete_test')).to.equal(67)
            sharedScope.delete('delete_test')
            expect(sharedScope.get<number>('delete_test')).to.equal(null)
            done()
        })

        it('should delete the value from all accessible scopes', (done) => {
            setTimeout(() => {
                sharedScope.set('test_val', 78)
                expect(sharedScope.get<number>('test_val')).to.equal(78)
                setTimeout(() => {
                    expect(sharedScope.get<number>('test_val')).to.equal(78)
                    sharedScope.set('test_val', 56)
                    expect(sharedScope.get<number>('test_val')).to.equal(56)
                    setTimeout(() => {
                        expect(sharedScope.get<number>('test_val')).to.equal(56)
                        sharedScope.set('test_val', 23)
                        expect(sharedScope.get<number>('test_val')).to.equal(23)
                        setTimeout(() => {
                            expect(sharedScope.get<number>('test_val')).to.equal(23)
                            sharedScope.set('test_val', 789)
                            expect(sharedScope.get<number>('test_val')).to.equal(789)
                            sharedScope.delete('test_val')
                            expect(sharedScope.get<number>('test_val')).to.equal(null)
                            done()
                        }, 100)
                    }, 100)
                }, 100)
            }, 100)
        })
    })
})
