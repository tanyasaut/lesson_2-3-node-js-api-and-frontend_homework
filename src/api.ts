import type { Loan, LoanInput, Snapshot } from '../shared/loan.ts'

// Готовый транспорт: различает сетевой отказ, HTTP-ошибку и неверный ответ.
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(path, options) }
  catch { throw new Error('Нет связи с сервером. Проверьте API и повторите действие вручную.') }
  const text = await response.text()
  let body: { data?: T; error?: { message?: string } } | null = null
  try { body = JSON.parse(text) } catch { /* Прокси-сервер может вернуть ответ не в формате JSON. */ }
  if (!response.ok) throw new Error(body?.error?.message ?? 'HTTP ' + response.status + '. Проверьте терминал API.')
  if (body === null || typeof body !== 'object' || !('data' in body)) throw new Error('Неожиданный ответ API.')
  return body.data as T
}
export const getSnapshot = (): Promise<Snapshot> => request('/api/loans')

// А3: реализуйте операции клиента по опубликованному контракту API.
export async function issue(_input: LoanInput): Promise<Loan> {
  return request<Loan>('/api/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(_input),
  })
}
export async function takeBack(_id: string): Promise<Loan> {
  return request<Loan>(`/api/loans/${encodeURIComponent(_id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'returned' }),
  })
}

