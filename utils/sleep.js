/**
 * 通用工具函数 - Sleep 延迟等待
 * 提供各种延迟等待的方法
 */

/**
 * 基础 sleep 函数
 * @param {number} ms - 等待的毫秒数
 * @returns {Promise} Promise 对象
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 按秒等待
 * @param {number} seconds - 等待的秒数
 * @returns {Promise} Promise 对象
 */
function sleepSeconds(seconds) {
  return sleep(seconds * 1000);
}

/**
 * 按分钟等待
 * @param {number} minutes - 等待的分钟数
 * @returns {Promise} Promise 对象
 */
function sleepMinutes(minutes) {
  return sleep(minutes * 60 * 1000);
}

/**
 * 随机延迟 - 在指定范围内随机等待
 * @param {number} minMs - 最小等待毫秒数
 * @param {number} maxMs - 最大等待毫秒数
 * @returns {Promise} Promise 对象
 */
function randomSleep(minMs, maxMs) {
  const randomMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(randomMs);
}

/**
 * 随机秒数延迟
 * @param {number} minSeconds - 最小等待秒数
 * @param {number} maxSeconds - 最大等待秒数
 * @returns {Promise} Promise 对象
 */
function randomSleepSeconds(minSeconds, maxSeconds) {
  return randomSleep(minSeconds * 1000, maxSeconds * 1000);
}

/**
 * 带进度显示的延迟
 * @param {number} seconds - 等待的秒数
 * @param {string} message - 显示的消息
 * @returns {Promise} Promise 对象
 */
async function sleepWithProgress(seconds, message = '等待中') {
  console.log(`${message}: ${seconds}秒`);
  
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r${message}: ${i}秒`);
    await sleep(1000);
  }
  
  console.log(`\r${message}: 完成!`);
}

/**
 * 可取消的延迟
 * @param {number} ms - 等待的毫秒数
 * @returns {Object} 包含 promise 和 cancel 方法的对象
 */
function cancellableSleep(ms) {
  let timeoutId;
  let cancelResolve;
  
  const promise = new Promise((resolve, reject) => {
    cancelResolve = resolve;
    timeoutId = setTimeout(resolve, ms);
  });
  
  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      cancelResolve();
    }
  };
  
  return { promise, cancel };
}

module.exports = {
  sleep,
  sleepSeconds,
  sleepMinutes,
  randomSleep,
  randomSleepSeconds,
  sleepWithProgress,
  cancellableSleep
};