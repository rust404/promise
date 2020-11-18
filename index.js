const isFunction  = (value) => typeof value === 'function'
const isObject = (value) => !!(value && typeof value === 'object')
const isThenable = (value) => (isObject(value) || isFunction(value)) && 'then' in value
const isPromise = (value) => value instanceof Promise

const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

const handleCallback = (callback, state, result) => {
  const {onFulfilled, onRejected, resolve, reject} = callback
  // 父Promise的状态不会影响then promise的状态，只会决定then promise选择onFulfilled还是onRejected作为结果
  try {
    if (state === FULFILLED) {
      isFunction(onFulfilled) ? resolve(onFulfilled(result)) : resolve(result)
    } else {
      // 注意，如果onReject不存在，那么将穿透错误reject(result)
      isFunction(onRejected) ? resolve(onRejected(result)) : reject(result)
    }
  } catch(err) {
    reject(err)
  }
}

const handleCallbacks = (callbacks, state, result) => {
  setTimeout(() => {
    while(callbacks.length) handleCallback(callbacks.shift(), state, result)
  }, 0)
}

const transition = (promise, state, result) => {
  if (promise.state !== PENDING) return
  promise.state = state
  promise.result = result
  handleCallbacks(promise.callbacks, state, result)
}

// resolve的参数value有若干种情况：
// 1. 是Promise本身，抛出类型错误
// 2. 是另一个Promise，则沿用那么Promise的值和状态
// 3. 是一个thenable对象，
const resolvePromise = (promise, result, onFulfilled, onRejected) => {
  if (promise === result) {
    return onRejected(new TypeError('Cannot fulfilled a promise with itself'))
  }
  if (isPromise(result)) {
    return result.then(onFulfilled, onRejected)
  }
  if (isThenable(result)) {
    try {
      const then = result.then
      if (isFunction(then)) {
        return new Promise(then.bind(result)).then(onFulfilled, onRejected)
      }
    } catch(err) {
      return onRejected(err)
    }
  }
  onFulfilled(result)
}

function Promise(executor) {
  this.state = PENDING
  this.result = undefined
  this.callbacks = []

  const onFulfilled = (value) => transition(this, FULFILLED, value)
  const onRejected = (reason) => transition(this, REJECTED, reason)

  let pending = true

  const resolve = (value) => {
    if (!pending) return
    pending = false
    resolvePromise(this, value, onFulfilled, onRejected)
  }

  const reject = (reason) => {
    if (!pending) return
    pending = false
    onRejected(reason)
  }
  try {
    executor(resolve, reject)
  } catch(err) {
    reject(err)
  }
}

Promise.prototype.then = function(onFulfilled, onRejected) {
  // then需要返回Promise
  return new Promise((resolve, reject) => {
    const callback = { onFulfilled, onRejected, resolve, reject}
    // 注意由于使用箭头函数，所以this指向父Promise
    // 如果父Promise在PENDING，那么直接进回调队列
    // 如果父Promise不在PENDING，那么直接执行
    this.callbacks.push(callback)
    if (this.state !== PENDING) {
      handleCallbacks(this.callbacks, this.state, this.result)
    }
  })
}

Promise.resolve = (value) => new Promise((resolve) => resolve(value))
Promise.reject = (reason) => new Promise((_, reject) => reject(reason))

module.exports = Promise
