import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Account from '../views/Account.vue'
import Track from '../views/Track.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/search', name: 'search', component: Home },
  { path: '/account', name: 'account', component: Account },
  { path: '/track/:id', name: 'track', component: Track },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router