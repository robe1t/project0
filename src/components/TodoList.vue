<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue';
import draggable from 'vuedraggable';

const newTodo = ref('');
const todos = ref([]);
const loading = ref(true);
const error = ref(null);
const filter = ref('all'); // all, active, completed
const editingTodo = ref(null); // 当前正在编辑的待办事项
const editingText = ref(''); // 编辑时的临时文本
const editingTips = ref(''); // 编辑时的临时提示

// 基于筛选条件的待办事项
const filteredTodos = computed({
  get: () => {
    let filtered = [...todos.value];
    if (filter.value === 'active') {
      filtered = filtered.filter(todo => !todo.completed);
    } else if (filter.value === 'completed') {
      filtered = filtered.filter(todo => todo.completed);
    }
    return filtered;
  },
  set: (value) => {
    // 当拖拽结束时，更新原始数组的顺序
    const originalTodos = [...todos.value];
    const filteredIds = value.map(todo => todo.id);
    todos.value = filteredIds.map(id => 
      originalTodos.find(todo => todo.id === id)
    );
    saveTodos();
  }
});

// 统计数据
const stats = computed(() => {
  const total = todos.value.length;
  const completed = todos.value.filter(todo => todo.completed).length;
  const active = total - completed;
  return { total, completed, active };
});

// 检查是否在Electron环境中
const isElectron = () => {
  return window && window.process && window.process.type;
};

// 加载待办事项
const loadTodos = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    console.log('开始加载待办事项');
    const ipcRenderer = require('electron').ipcRenderer;
    const result = await ipcRenderer.invoke('todos:get');
    console.log('加载结果:', result);
    
    if (result.success) {
      // 确保日期格式正确
      todos.value = result.data.map(todo => ({
        ...todo,
        createdAt: new Date(todo.createdAt),
        updatedAt: new Date(todo.updatedAt)
      }));
      console.log('成功加载待办事项:', todos.value);
    } else {
      error.value = '加载待办事项失败: ' + (result.error || '未知错误');
      console.error('加载待办事项失败:', result.error);
    }
  } catch (error) {
    error.value = '加载待办事项失败: ' + error.message;
    console.error('加载待办事项失败:', error);
  } finally {
    loading.value = false;
  }
}

// 保存待办事项
const saveTodos = async () => {
  try {
    error.value = null;
    // 确保数据是可序列化的
    const serializableTodos = todos.value.map(todo => ({
      id: todo.id,
      text: todo.text,
      completed: todo.completed,
      createdAt: todo.createdAt instanceof Date ? todo.createdAt.toISOString() : new Date(todo.createdAt).toISOString(),
      updatedAt: todo.updatedAt instanceof Date ? todo.updatedAt.toISOString() : new Date(todo.updatedAt).toISOString(),
      tips: todo.tips || '',
      starred: todo.starred || false
    }));
    
    console.log('准备保存待办事项:', serializableTodos);
    const ipcRenderer = require('electron').ipcRenderer;
    const result = await ipcRenderer.invoke('todos:save', serializableTodos);
    console.log('保存结果:', result);
    
    if (!result.success) {
      error.value = '保存待办事项失败: ' + (result.error || '未知错误');
      console.error('保存待办事项失败:', result.error);
    }
  } catch (error) {
    error.value = '保存待办事项失败: ' + error.message;
    console.error('保存待办事项失败:', error);
  }
}

// 开始编辑待办事项
const startEdit = (todo) => {
  editingTodo.value = todo;
  editingText.value = todo.text;
  editingTips.value = todo.tips || '';
};

// 保存编辑
const saveEdit = () => {
  if (editingTodo.value) {
    editingTodo.value.text = editingText.value;
    editingTodo.value.tips = editingTips.value;
    editingTodo.value.updatedAt = new Date();
    editingTodo.value = null;
    saveTodos();
  }
};

// 取消编辑
const cancelEdit = () => {
  editingTodo.value = null;
};

// 切换星标状态
const toggleStar = (todo) => {
  todo.starred = !todo.starred;
  todo.updatedAt = new Date();
  
  // 如果标记为星标，将任务移到第一个非星标任务之前
  if (todo.starred) {
    const index = todos.value.findIndex(t => t.id === todo.id);
    const firstNonStarredIndex = todos.value.findIndex(t => !t.starred);
    
    if (index !== -1 && firstNonStarredIndex !== -1 && index > firstNonStarredIndex) {
      // 将任务移动到第一个非星标任务之前
      const [movedTodo] = todos.value.splice(index, 1);
      todos.value.splice(firstNonStarredIndex, 0, movedTodo);
    }
  }
  
  saveTodos();
};

// 添加待办事项
const addTodo = () => {
  if (newTodo.value.trim()) {
    const now = new Date();
    todos.value.push({
      id: Date.now(),
      text: newTodo.value,
      completed: false,
      createdAt: now,
      updatedAt: now,
      tips: '',
      starred: false
    });
    newTodo.value = '';
    saveTodos();
  }
};

// 切换完成状态
const toggleTodo = (todo) => {
  todo.completed = !todo.completed;
  todo.updatedAt = new Date();
  saveTodos();
};

// 删除待办事项
const deleteTodo = (id) => {
  todos.value = todos.value.filter(todo => todo.id !== id);
  saveTodos();
};

// 清除已完成的待办事项
const clearCompleted = () => {
  todos.value = todos.value.filter(todo => !todo.completed);
  saveTodos();
};

// 添加拖拽相关状态
const drag = ref(false);
const dragOptions = {
  animation: 150,
  ghostClass: 'ghost',
  dragClass: 'drag',
  chosenClass: 'chosen'
};

// 修改拖拽结束处理函数
const onDragEnd = (evt) => {
  drag.value = false;
  
  // 获取原始todos数组
  const originalTodos = [...todos.value];
  
  // 获取过滤后的todos的ID顺序
  const filteredIds = filteredTodos.value.map(todo => todo.id);
  
  // 根据过滤后的顺序重新排序原始数组
  todos.value = filteredIds.map(id => 
    originalTodos.find(todo => todo.id === id)
  );
  
  saveTodos();
};

// 添加时间格式化函数
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // 如果是今天
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 如果是昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 如果是今年
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 其他情况显示完整日期
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 当组件挂载时加载数据
onMounted(() => {
  console.log('组件挂载，准备加载数据');
  loadTodos();
});

// 监听todos变化，自动保存
watch(todos, () => {
  console.log('todos发生变化，准备保存');
  saveTodos();
}, { deep: true });
</script>

<template>
  <div class="todo-container">
    <h1>Todo List（小神龙版）</h1>
    
    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <!-- 加载提示 -->
    <div v-if="loading" class="loading">
      加载中...
    </div>
    
    <div v-else>
      <div class="input-container">
        <input
          type="text"
          v-model="newTodo"
          @keyup.enter="addTodo"
          placeholder="添加新的待办事项"
        />
        <button @click="addTodo" class="add-btn">添加</button>
      </div>
      
      <!-- 筛选器 -->
      <div class="filters">
        <button 
          @click="filter = 'all'" 
          :class="{ active: filter === 'all' }"
          class="filter-btn"
        >
          全部 ({{ stats.total }})
        </button>
        <button 
          @click="filter = 'active'" 
          :class="{ active: filter === 'active' }"
          class="filter-btn"
        >
          未完成 ({{ stats.active }})
        </button>
        <button 
          @click="filter = 'completed'" 
          :class="{ active: filter === 'completed' }"
          class="filter-btn"
        >
          已完成 ({{ stats.completed }})
        </button>
        <button 
          v-if="stats.completed > 0"
          @click="clearCompleted" 
          class="clear-btn"
        >
          清除已完成
        </button>
      </div>
      
      <p v-if="filteredTodos.length === 0" class="empty-message">
        {{ filter === 'all' ? '没有待办事项，请添加新的待办事项' : 
           filter === 'active' ? '没有未完成的待办事项' : '没有已完成的待办事项' }}
      </p>
      
      <draggable
        v-model="filteredTodos"
        :animation="dragOptions.animation"
        :ghost-class="dragOptions.ghostClass"
        :drag-class="dragOptions.dragClass"
        :chosen-class="dragOptions.chosenClass"
        @start="drag = true"
        @end="onDragEnd"
        item-key="id"
        handle=".drag-handle"
        :force-fallback="true"
      >
        <template #item="{ element: todo }">
          <div class="todo-item" :class="{ 
            completed: todo.completed,
            starred: todo.starred,
            editing: editingTodo?.id === todo.id
          }">
            <div class="todo-main">
              <div class="todo-left">
                <div class="drag-handle">
                  <span class="drag-icon">⋮</span>
                </div>
                <input
                  type="checkbox"
                  :checked="todo.completed"
                  @change="toggleTodo(todo)"
                  class="todo-checkbox"
                >
                <template v-if="editingTodo?.id === todo.id">
                  <input
                    type="text"
                    v-model="editingText"
                    class="edit-input"
                    @keyup.enter="saveEdit"
                    @keyup.esc="cancelEdit"
                  >
                </template>
                <template v-else>
                  <span class="todo-text">{{ todo.text }}</span>
                </template>
              </div>
              <div class="todo-right">
                <div v-if="todo.tips" class="todo-tips">
                  {{ todo.tips }}
                </div>
              </div>
            </div>
            
            <div class="todo-bottom">
              <template v-if="editingTodo?.id === todo.id">
                <textarea
                  v-model="editingTips"
                  class="edit-tips"
                  placeholder="添加提示信息..."
                  @keyup.enter="saveEdit"
                  @keyup.esc="cancelEdit"
                ></textarea>
                <div class="edit-actions">
                  <button @click="saveEdit" class="save-btn">保存</button>
                  <button @click="cancelEdit" class="cancel-btn">取消</button>
                </div>
              </template>
              <template v-else>
                <div class="todo-bottom-content">
                  <span class="todo-time" :class="{ 'completed': todo.completed }">{{ formatTime(todo.createdAt) }}</span>
                  <div class="todo-actions">
                    <button 
                      class="star-btn"
                      :class="{ active: todo.starred }"
                      @click="toggleStar(todo)"
                      title="标记重要"
                    >
                      ★
                    </button>
                    <button 
                      class="edit-btn"
                      @click="startEdit(todo)"
                      title="编辑"
                    >
                      ✎
                    </button>
                    <button 
                      class="delete-btn" 
                      @click="deleteTodo(todo.id)"
                      title="删除"
                    >×</button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<style scoped>
.todo-container {
  max-width: 600px;
  width: 100%;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(99, 75, 180, 0.1);
  overflow: auto;
}

h1 {
  color: #2c3e50;
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
}

.input-container {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

input[type="text"] {
  flex: 1;
  padding: 0.8rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  background-color: #ffffff;
  color: #2c3e50;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

input[type="text"]:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 4px 6px rgba(66, 153, 225, 0.2);
}

.add-btn {
  padding: 0.8rem 1.5rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.add-btn:hover {
  background: #3182ce;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.filter-btn {
  padding: 0.5rem 1rem;
  background: #edf2f7;
  color: #4a5568;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: #e2e8f0;
}

.filter-btn.active {
  background: #4299e1;
  color: white;
}

.clear-btn {
  padding: 0.5rem 1rem;
  background: #f56565;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  margin-left: auto;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: #e53e3e;
}

.todo-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.todo-item {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: #579adc;
  border-left: 4px solid #4299e1;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.todo-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.todo-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.todo-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0rem;
}

.todo-bottom {
  margin-top: 0.2rem;
  padding-top: 0.2rem;
}

.todo-bottom-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  width: 100%;
  padding-left: 0;
}

.todo-checkbox {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
  margin: 0;
  border-radius: 4px;
  border: 2px solid #e2e8f0;
  transition: all 0.2s ease;
}

.todo-checkbox:checked {
  background-color: #48bb78;
  border-color: #48bb78;
  transform: scale(1.1);
}

.todo-text {
  font-size: 1rem;
  color: #2d3748;
  flex: 1;
}

.edit-input {
  flex: 1;
  padding: 0.8rem;
  border: 2px solid #4299e1;
  border-radius: 6px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 4px rgba(66, 153, 225, 0.2);
  transition: all 0.3s ease;
}

.edit-input:focus {
  outline: none;
  box-shadow: 0 4px 6px rgba(66, 153, 225, 0.3);
}

.edit-tips {
  width: 100%;
  padding: 0.8rem;
  border: 2px solid #4299e1;
  border-radius: 6px;
  font-size: 0.875rem;
  min-height: 80px;
  resize: vertical;
  background: rgba(99, 62, 62, 0.95);
  box-shadow: 0 2px 4px rgba(66, 153, 225, 0.2);
  transition: all 0.3s ease;
  margin-bottom: 0.5rem;
}

.edit-tips:focus {
  outline: none;
  box-shadow: 0 4px 6px rgba(66, 153, 225, 0.3);
}

.todo-time {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
  margin-right: 15rem;
  margin-left: 0;
  padding-left: 0;
}

.todo-time.completed {
  text-decoration: line-through;
  opacity: 0.6;
}

.todo-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.star-btn, .edit-btn, .delete-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  transition: all 0.2s ease;
  opacity: 0.6;
  color: rgba(255, 255, 255, 0.8);
}

.star-btn:hover, .edit-btn:hover, .delete-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.star-btn.active {
  color: #f6ad55;
  opacity: 1;
}

.todo-tips {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  line-height: 1.4;
  max-width: 200px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: all 0.2s ease;
}

.todo-tips:hover {
  white-space: normal;
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.15);
}

.edit-actions {
  display: flex;
  gap: 0.8rem;
  margin-top: 0.8rem;
  justify-content: flex-end;
}

.save-btn, .cancel-btn {
  padding: 0.5rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.save-btn {
  background: #32bd6c;
  color: white;
  border: none;
}

.save-btn:hover {
  background: #32b56f;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(72, 187, 120, 0.3);
}

.cancel-btn {
  background: #dc4e4e;
  color: white;
  border: none;
}

.cancel-btn:hover {
  background: #bf3c3c;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(229, 62, 62, 0.3);
}

.todo-item.editing {
  background: #4299e1;
  border-left-color: #3182ce;
  box-shadow: 0 4px 6px rgba(66, 153, 225, 0.2);
}

/* 优化拖动手柄样式 */
.drag-handle {
  cursor: move;
  padding: 0.5rem;
  color: rgba(255, 255, 255, 0.6);
  user-select: none;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

.drag-handle:hover {
  color: rgba(255, 255, 255, 0.9);
}

.drag-icon {
  font-size: 1.2rem;
  line-height: 1;
}

/* 优化完成状态样式 */
.todo-item.completed {
  opacity: 0.8;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.6);
}

/* 优化星标样式 */
.todo-item.starred {
  background: #f6ad55;
  border-left-color: #f6ad55;
}

.todo-item.starred .todo-text {
  color: #2d3748;
}

.error-message {
  background-color: #fed7d7;
  color: #c53030;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #718096;
}

.empty-message {
  text-align: center;
  color: #718096;
  padding: 1rem;
}

/* Transition animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 添加拖拽相关样式 */
.ghost {
  opacity: 0.5;
  background: #c8ebfb;
}

.drag {
  opacity: 0.9;
  background: #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chosen {
  background: #f8f9fa;
}

/* 优化动画效果 */
.todo-item {
  transition: all 0.3s ease;
  transform-origin: center;
}

.todo-item:hover {
  transform: translateX(4px);
}

.todo-item.completed {
  opacity: 0.7;
  transform: scale(0.98);
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  color: #999;
}

/* 优化删除按钮动画 */
.delete-btn {
  opacity: 0;
  transition: all 0.2s ease;
}

.todo-item:hover .delete-btn {
  opacity: 1;
}

/* 优化复选框动画 */
input[type="checkbox"] {
  transition: all 0.2s ease;
}

input[type="checkbox"]:checked {
  transform: scale(1.1);
}

/* 优化时间显示 */
.todo-time {
  font-size: 0.8em;
  color: #999;
  margin-left: auto;
  transition: color 0.2s;
}

.todo-item:hover .todo-time {
  color: #666;
}

/* 优化过滤按钮动画 */
.filter-btn {
  transition: all 0.2s ease;
}

.filter-btn:hover {
  transform: translateY(-1px);
}

.filter-btn.active {
  transform: scale(1.05);
}

/* 优化清除按钮动画 */
.clear-btn {
  transition: all 0.2s ease;
}

.clear-btn:hover {
  transform: translateY(-1px);
  background-color: #ff4444;
}

/* 优化输入框动画 */
.todo-input {
  transition: all 0.3s ease;
}

.todo-input:focus {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style> 