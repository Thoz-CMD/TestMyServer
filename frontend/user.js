import { BASE_URL, apiReady } from './config.js'
import { showToast, openModal, showLoading, hideLoading } from './ui.js'

let dataTable = null
let cache = []

const skeleton = document.getElementById('tableSkeleton')
const emptyState = document.getElementById('emptyState')
const tbody = document.getElementById('userBody')

function setLoading(on) {
    if (skeleton) skeleton.style.display = on ? 'block' : 'none'
}

function buildActions(user) {
    return `
        <div class="table-actions" style="display:flex; gap:.35rem;">
            <a class="btn secondary edit-link" data-edit-id="${user.id}" style="font-size:.6rem; padding:.45rem .55rem" href="index.html?id=${user.id}" title="แก้ไข"><i class="fa-solid fa-pen"></i></a>
            <button class="btn danger" style="font-size:.6rem; padding:.45rem .55rem" data-action="delete" data-id="${user.id}" title="ลบ"><i class="fa-solid fa-trash"></i></button>
        </div>`
}

function renderRows(rows) {
    tbody.innerHTML = ''
    rows.forEach(u => {
        const tr = document.createElement('tr')
        const desc = (u.description || '').length > 120 ? (u.description.substring(0,117) + '…') : (u.description || '')
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.firstname || ''}</td>
            <td>${u.lastname || ''}</td>
            <td>${u.age ?? ''}</td>
            <td>${u.gender || ''}</td>
            <td>${u.interests || ''}</td>
            <td title="${(u.description || '').replace(/"/g,'&quot;')}">${desc}</td>
            <td>${buildActions(u)}</td>`
        tbody.appendChild(tr)
    })
    emptyState.style.display = rows.length ? 'none' : 'block'
}

async function loadData() {
    setLoading(true)
    try {
        const { data } = await axios.get(`${BASE_URL}/users`)
        cache = data
        renderRows(cache)
    } catch (e) {
        console.error(e)
        showToast('โหลดข้อมูลไม่สำเร็จ', { type: 'danger' })
    } finally {
        setLoading(false)
    }
}

function filter(term) {
    const q = term.trim().toLowerCase()
    if (!q) { renderRows(cache); return }
    const filtered = cache.filter(u => `${u.firstname} ${u.lastname}`.toLowerCase().includes(q))
    renderRows(filtered)
}

async function handleDelete(id) {
    const confirmed = await openModal({ title: 'ยืนยันการลบ', message: 'คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้นี้ ?', danger: true, confirmText: 'ลบ', cancelText: 'ยกเลิก' })
    if (!confirmed) return
    showLoading('กำลังลบ...')
    try {
        await axios.delete(`${BASE_URL}/users/${id}`)
        showToast('ลบสำเร็จ', { type: 'success' })
        await loadData()
    } catch (e) {
        console.error(e)
        showToast('ลบไม่สำเร็จ', { type: 'danger' })
    } finally {
        hideLoading()
    }
}

function attachDelegates() {
    document.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action=delete]')
        if (btn) {
            const id = btn.dataset.id
            handleDelete(id)
        }
        const editLink = e.target.closest('a.edit-link')
        if (editLink) {
            const editId = editLink.getAttribute('data-edit-id')
            if (editId) {
                try { localStorage.setItem('lastEditUserId', editId) } catch {}
            }
        }
    })
    const searchInput = document.getElementById('searchInput')
    if (searchInput) {
        searchInput.addEventListener('input', e => filter(e.target.value))
    }
    const clearBtn = document.getElementById('clearSearch')
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = ''
            filter('')
            showToast('ล้างการค้นหาแล้ว', { type: 'info', timeout: 1800 })
        })
    }
    const refreshBtn = document.getElementById('refreshBtn')
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadData()
            showToast('รีเฟรชแล้ว', { type: 'success', timeout: 1600 })
        })
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    await apiReady
    attachDelegates()
    loadData()
})
