import { expect } from 'code'
import * as Lab from 'lab'

import * as Bluebird from 'bluebird'
import { AsyncScope } from '../../main/'

export const lab = Lab.script()

const describe = lab.describe
const it = lab.it

describe('AsyncScope', () => {
    describe('set', () => {
        it('should add value to current execution scope', (done) => {
            const asyncScope = new AsyncScope()
            asyncScope.set('set_test', 45)
            expect(asyncScope.get<number>('set_test')).to.equal(45)
            done()
        })
    })

    describe('get', () => {
        it('should allow fetching of values set on the same call tree', (done) => {
            const asyncScope = new AsyncScope()
            setTimeout(() => {
                function childFunction() {
                    expect(asyncScope.get<number>('foo')).to.equal(6)
                    asyncScope.set('bar', 89)
                }

                function parentFunction() {
                    asyncScope.set('foo', 6)
                    setTimeout(() => {
                        childFunction()
                    }, 50)

                    setTimeout(() => {
                        expect(asyncScope.get<number>('foo')).to.equal(6)
                        expect(asyncScope.get<number>('bar')).to.equal(null)
                        done()
                    }, 250)
                }

                parentFunction()
            }, 500)
        })

        it('should not allow fetching of values set on different async call trees', (done) => {
            const asyncScope = new AsyncScope()
            setTimeout(() => { // runs first
                asyncScope.set('boom', 109)

                function childFunction() { // runs fourth
                    expect(asyncScope.get<number>('boo')).to.equal(null)
                }

                function parentFunction() { // runs third
                    asyncScope.set('bam', 98)
                    setTimeout(childFunction, 200)
                }

                parentFunction()
            }, 100)

            setTimeout(() => { // runs second
                asyncScope.set('boo', 37)
                expect(asyncScope.get<number>('boom')).to.equal(null)

                function childFunction() { // runs sixth
                    expect(asyncScope.get<number>('bam')).to.equal(null)
                    done()
                }

                function parentFunction() { // runs fifth
                    setTimeout(childFunction, 200)
                }

                parentFunction()
            }, 200)
        })

        it('should correctly fetch values across multiple sibling async contexts', (done) => {
            const asyncScope = new AsyncScope()
            const values: Array<number> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            asyncScope.set('all_siblings', 456)
            values.forEach((next: number) => {
                setTimeout(() => {
                    asyncScope.set(`key_${next}`, next)
                    setTimeout(() => {
                        expect(asyncScope.get<number>(`key_${next}`)).to.equal(next)
                        expect(asyncScope.get<number>('all_siblings')).to.equal(456)
                        values.forEach((v) => {
                            if (v !== next) {
                                expect(asyncScope.get<number>(`key_${v}`)).to.equal(null)
                            } else {
                                expect(asyncScope.get<number>(`key_${v}`)).to.equal(next)
                            }
                        })

                        if (next === 10) {
                            done()
                        }
                    }, (200 + (next * 200)))
                }, (200 - (next * 18)))
            })
        })

        it('should correctly access scope of a promise', (done) => {
            const asyncScope = new AsyncScope()
            const resolvedPromise = Promise.resolve()
            asyncScope.set('test_1', 'value_1')

            function makePromise() {
                return new Promise((resolve, reject) => {
                    resolve(5)
                })
            }

            setTimeout(() => {
                asyncScope.set('test_2', 'value_2')
                resolvedPromise.then(() => {
                    expect(asyncScope.get<string>('test_1')).to.equal('value_1')
                    expect(asyncScope.get<string>('test_2')).to.equal('value_2')
                    makePromise().then((val) => {
                        asyncScope.set('test_3', 'value_3')
                        expect(asyncScope.get<string>('test_2')).to.equal('value_2')
                        expect(asyncScope.get<string>('test_3')).to.equal('value_3')
                    })
                }).catch((err) => {
                    done(err)
                })
            }, 200)

            setTimeout(() => {
                resolvedPromise.then(() => {
                    expect(asyncScope.get<string>('test_2')).to.equal(null)
                    expect(asyncScope.get<string>('test_3')).to.equal(null)
                    done()
                })
            }, 300)
        })

        it('should correctly access scope of a Bluebird promise', (done) => {
            const asyncScope = new AsyncScope()
            const resolvedPromise = Bluebird.resolve()
            asyncScope.set('test_1', 'value_1')

            function makePromise() {
                return new Bluebird((resolve, reject) => {
                    resolve(5)
                })
            }

            setTimeout(() => {
                asyncScope.set('test_2', 'value_2')
                resolvedPromise.then(() => {
                    expect(asyncScope.get<string>('test_1')).to.equal('value_1')
                    expect(asyncScope.get<string>('test_2')).to.equal('value_2')
                    makePromise().then((val) => {
                        asyncScope.set('test_3', 'value_3')
                        expect(asyncScope.get<string>('test_2')).to.equal('value_2')
                        expect(asyncScope.get<string>('test_3')).to.equal('value_3')
                    })
                }).catch((err) => {
                    done(err)
                })
            }, 200)

            setTimeout(() => {
                resolvedPromise.then(() => {
                    expect(asyncScope.get<string>('test_2')).to.equal(null)
                    expect(asyncScope.get<string>('test_3')).to.equal(null)
                    done()
                })
            }, 300)
        })
    })

    describe('delete', () => {
        it('should delete an existing value from the store', (done) => {
            const asyncScope = new AsyncScope()
            asyncScope.set('delete_test', 67)
            expect(asyncScope.get<number>('delete_test')).to.equal(67)
            asyncScope.delete('delete_test')
            expect(asyncScope.get<number>('delete_test')).to.equal(null)
            done()
        })

        it('should delete the value from all accessible scopes', (done) => {
            const asyncScope = new AsyncScope()
            setTimeout(() => {
                asyncScope.set('test_val', 78)
                expect(asyncScope.get<number>('test_val')).to.equal(78)
                setTimeout(() => {
                    expect(asyncScope.get<number>('test_val')).to.equal(78)
                    asyncScope.set('test_val', 56)
                    expect(asyncScope.get<number>('test_val')).to.equal(56)
                    setTimeout(() => {
                        expect(asyncScope.get<number>('test_val')).to.equal(56)
                        asyncScope.set('test_val', 23)
                        expect(asyncScope.get<number>('test_val')).to.equal(23)
                        setTimeout(() => {
                            expect(asyncScope.get<number>('test_val')).to.equal(23)
                            asyncScope.set('test_val', 789)
                            expect(asyncScope.get<number>('test_val')).to.equal(789)
                            asyncScope.delete('test_val')
                            expect(asyncScope.get<number>('test_val')).to.equal(null)
                            done()
                        }, 100)
                    }, 100)
                }, 100)
            }, 100)
        })
    })
})
