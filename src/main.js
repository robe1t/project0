import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// 添加全局错误处理
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  alert('应用发生错误: ' + event.error.message);
});

try {
  console.log('Vue应用初始化开始');
  const app = createApp(App);
  app.mount('#app');
  console.log('Vue应用挂载完成');
} catch (error) {
  console.error('Vue应用初始化失败:', error);
  alert('Vue应用初始化失败: ' + error.message);
}
