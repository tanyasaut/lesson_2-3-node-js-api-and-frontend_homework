import type { Loan, Snapshot } from '../shared/loan.ts'
import { STOCK } from './seed.ts'
import { store } from './store.ts'
import { HttpError } from './http.ts'

// Чтение уже работает. Параметры URL понадобятся только для бонуса Д1.
export async function listLoans(_url: URL): Promise<Snapshot> {
  const loans = await store.list()

  if (!_url.searchParams.has('status')) {
    return { stock: STOCK, loans }
  }

  const all = _url.searchParams.getAll('status')
  if (all.length !== 1) {
    throw new HttpError(400, 'INVALID_FILTER', 'Параметр status должен быть указан ровно один раз.')
  }

  const value = all[0]
  if (value === 'all') {
    return { stock: STOCK, loans }
  }
  if (value !== 'active' && value !== 'returned') {
    throw new HttpError(400, 'INVALID_FILTER', 'Допустимые значения status: active, returned, all.')
  }

  return { stock: STOCK, loans: loans.filter(loan => loan.status === value) }
}

// А1: проверка выдачи и доступного остатка.
// Сетевой ввод недоверенный; за изменение файла отвечает готовый store.edit.
export async function createLoan(_body: unknown): Promise<Loan> {
  if (typeof _body !== 'object' || _body === null || Array.isArray(_body)) {
    throw new HttpError(400, 'INVALID_INPUT', 'Тело запроса должно быть JSON-объектом.')
  }

  const { borrower, quantity } = _body as Record<string, unknown>

  if (typeof borrower !== 'string' || borrower.trim().length === 0) {
    throw new HttpError(400, 'INVALID_INPUT', 'Имя заёмщика должно быть непустой строкой.')
  }
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 3) {
    throw new HttpError(400, 'INVALID_INPUT', 'Количество — целое число от 1 до 3.')
  }

  const name = borrower.trim()

  return store.edit(draft => {
    const active = draft.filter(loan => loan.status === 'active')
    const used = active.reduce((sum, loan) => sum + loan.quantity, 0)
    const available = STOCK - used

    if (quantity > available) {
      throw new HttpError(409, 'NOT_ENOUGH_STOCK', `Недостаточно микрофонов. Доступно: ${available}.`)
    }

    const loan: Loan = {
      id: crypto.randomUUID(),
      borrower: name,
      quantity,
      status: 'active',
    }
    draft.push(loan)
    return loan
  })
}


// А2: возврат оборудования и повторный запрос.
export async function returnLoan(_id: string, _body: unknown): Promise<Loan> {
  if (typeof _body !== 'object' || _body === null || Array.isArray(_body)) {
    throw new HttpError(400, 'INVALID_RETURN', 'Тело запроса должно быть JSON-объектом.')
  }

  const { status } = _body as Record<string, unknown>
  if (status !== 'returned') {
    throw new HttpError(400, 'INVALID_RETURN', 'Ожидается {"status":"returned"}.')
  }

  return store.edit(draft => {
    const loan = draft.find(item => item.id === _id)
    if (!loan) {
      throw new HttpError(404, 'NOT_FOUND', 'Выдача с таким id не найдена.')
    }
    if (loan.status === 'returned') return loan

    loan.status = 'returned'
    return loan
  })
}

