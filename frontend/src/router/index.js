import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Account from '../views/Account.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/account', component: Account },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router