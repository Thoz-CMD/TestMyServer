import { BASE_URL, apiReady } from './config.js'
import { showToast, showLoading, hideLoading, fieldErrors, serializeForm } from './ui.js'

let MODE = 'CREATE'
let currentId = null

function collectForm() {
  const form = document.getElementById('userForm')
  const data = serializeForm(form)
  // interests expected as comma separated string by backend
  data.interests = (data.interests && data.interests.length) ? data.interests.join(', ') : ''
  data.age = data.age !== undefined ? Number(data.age) : data.age
  return data
}

function validateLocal(data) {
  const errs = {}
  if (!data.firstname) errs.firstname = 'กรุณากรอกชื่อ'
  if (!data.lastname) errs.lastname = 'กรุณากรอกนามสกุล'
  if (data.firstname && data.firstname.length > 255) errs.firstname = 'ชื่อยาวเกิน 255'
  if (data.lastname && data.lastname.length > 255) errs.lastname = 'นามสกุลยาวเกิน 255'
  if (data.age === '' || data.age === undefined || isNaN(Number(data.age))) errs.age = 'กรุณากรอกอายุ'
  else if (Number(data.age) < 0 || Number(data.age) > 120) errs.age = 'อายุ 0-120 เท่านั้น'
  if (!data.gender) errs.gender = 'เลือกเพศ'
  if (!data.interests) errs.interests = 'เลือกความสนใจอย่างน้อย 1 รายการ'
  if (!data.description) errs.description = 'กรอกคำอธิบาย'
  if (data.description && data.description.length > 1000) errs.description = 'คำอธิบายไม่เกิน 1000 ตัวอักษร'
  return errs
}

async function loadForEdit(id) {
  try {
    const { data: user } = await axios.get(`${BASE_URL}/users/${id}`)
    const form = document.getElementById('userForm')
    console.debug('[edit] loaded user', user)
    form.firstname.value = user.firstname || ''
    form.lastname.value = user.lastname || ''
    form.age.value = user.age || ''
    form.description.value = user.description || ''
    // gender
    form.querySelectorAll('input[name=gender]').forEach(r => { r.checked = r.value === user.gender })
    // interests splitting by comma
    if (user.interests) {
      const items = user.interests.split(',').map(s => s.trim())
      const known = new Set(['หนังสือ','วิดีโอเกม','การเมือง'])
      const otherValues = []
      form.querySelectorAll('input[name=interest]').forEach(c => { c.checked = items.includes(c.value) })
      items.forEach(v => { if (!known.has(v)) otherValues.push(v) })
      if (otherValues.length) {
        const toggle = form.querySelector('input[name=interest_other_toggle]')
        const otherInput = document.getElementById('otherInterestInput')
        const otherWrap = document.getElementById('otherInterestWrapper')
        if (toggle && otherInput && otherWrap) {
          toggle.checked = true
          otherWrap.style.display = 'flex'
          otherInput.value = otherValues.join(', ')
        }
      }
    }
    document.getElementById('submitBtnLabel').textContent = 'อัพเดต'
    MODE = 'EDIT'
    currentId = id
  } catch (e) {
    showToast('ไม่สามารถโหลดข้อมูลเพื่อแก้ไข', { type: 'danger' })
    console.error(e)
  }
}

async function save() {
  const form = document.getElementById('userForm')
  const data = collectForm()
  const errs = validateLocal(data)
  fieldErrors(form, errs)
  if (Object.keys(errs).length) {
    showToast('กรุณาแก้ไขข้อมูลที่ไม่ถูกต้อง', { type: 'danger' })
    return
  }
  showLoading(MODE === 'CREATE' ? 'กำลังบันทึก...' : 'กำลังอัพเดต...')
  const btn = document.getElementById('submitBtn')
  const label = document.getElementById('submitBtnLabel')
  const old = label.textContent
  btn.disabled = true
  label.textContent = MODE === 'CREATE' ? 'กำลังบันทึก...' : 'กำลังอัพเดต...'
  try {
    if (MODE === 'CREATE') {
      await axios.post(`${BASE_URL}/users`, data)
      showToast('บันทึกสำเร็จ', { type: 'success' })
      form.reset()
    } else {
      await axios.put(`${BASE_URL}/users/${currentId}`, data)
      showToast('แก้ไขสำเร็จ', { type: 'success' })
    }
    fieldErrors(form, {})
  } catch (e) {
    console.error(e)
    const apiErr = e.response?.data
    if (apiErr?.errors?.length) {
      // Map server list into first error bucket (simple summary display)
      const mapped = {}
      apiErr.errors.forEach((msg, i) => { mapped['err'+i] = msg })
      fieldErrors(form, mapped)
    }
    showToast(apiErr?.message || 'เกิดข้อผิดพลาด', { type: 'danger' })
  } finally {
    hideLoading()
    btn.disabled = false
    label.textContent = old
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await apiReady
  console.log('API Base URL:', BASE_URL)
  const params = new URLSearchParams(location.search)
  let id = params.get('id')
  if (!id) {
    try { id = localStorage.getItem('lastEditUserId') || null } catch {}
  }
  if (id) await loadForEdit(id)
  // Safety: ensure panel visible if edit mode
  if (MODE === 'EDIT') {
    const panel = document.getElementById('previousDataPanel')
    if (panel && panel.dataset.loaded === '1') {
      panel.style.display = 'block'
    }
  }

  const form = document.getElementById('userForm')
  document.getElementById('submitBtn').addEventListener('click', save)
  document.getElementById('resetBtn').addEventListener('click', () => {
    MODE = 'CREATE'
    currentId = null
    document.getElementById('submitBtnLabel').textContent = 'บันทึก'
    fieldErrors(form, {})
    showToast('ล้างข้อมูลแล้ว', { type: 'info', timeout: 1800 })
    const panel = document.getElementById('previousDataPanel')
    if (panel) panel.style.display = 'none'
  })

  // Other interest toggle logic
  const otherToggle = form.querySelector('input[name=interest_other_toggle]')
  const otherInput = document.getElementById('otherInterestInput')
  const otherWrap = document.getElementById('otherInterestWrapper')
  if (otherToggle && otherInput && otherWrap) {
    const updateVisibility = () => {
      if (otherToggle.checked) {
        otherWrap.style.display = 'flex'
        otherInput.focus()
      } else {
        otherWrap.style.display = 'none'
        otherInput.value = ''
      }
    }
    otherToggle.addEventListener('change', updateVisibility)
  }

  // Live validation on blur
  form.addEventListener('blur', e => {
    if (!(e.target instanceof HTMLElement)) return
    if (!e.target.name) return
    const data = collectForm()
    const errs = validateLocal(data)
    fieldErrors(form, errs)
  }, true)
})


