export const FIELD_IDS = Object.freeze({
  type: '4c3befc0-5146-43a2-8610-86efe4e8124a',
  department: '9b3d2027-2162-42e2-81b9-d907592cdb5b',
  largeFile: '4f7eb8a3-5de7-4f3b-87bb-8be5dc2d573f',
})
export const FIELD_DEFINITIONS = Object.freeze([
  Object.freeze({ id: FIELD_IDS.type, type: 'drop_down' }),
  Object.freeze({ id: FIELD_IDS.department, type: 'drop_down' }),
  Object.freeze({ id: FIELD_IDS.largeFile, type: 'text' }),
])

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
function invalid() {
  throw new Error('Invalid support field')
}

/** Normalize the exact field shape consumed by the Server and checked by packaging. */
export function parseSupportField(input, id, expectedType) {
  if (
    !object(input) ||
    input.id !== id ||
    input.type !== expectedType ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 255 ||
    (input.required !== undefined && typeof input.required !== 'boolean') ||
    !object(input.type_config)
  )
    invalid()
  const options = []
  if (expectedType === 'drop_down') {
    const raw = input.type_config.options
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) invalid()
    for (const item of raw) {
      if (!object(item)) invalid()
      const orderindex = Number(item.orderindex)
      if (
        typeof item.id !== 'string' ||
        !uuid.test(item.id) ||
        typeof item.name !== 'string' ||
        !item.name.trim() ||
        item.name.length > 255 ||
        !Number.isSafeInteger(orderindex) ||
        orderindex < 0 ||
        orderindex > 500 ||
        (item.color !== undefined &&
          item.color !== null &&
          (typeof item.color !== 'string' || item.color.length > 32))
      )
        invalid()
      options.push({
        id: item.id,
        name: item.name,
        color: typeof item.color === 'string' ? item.color : null,
        orderindex,
      })
    }
    if (
      new Set(options.map((option) => option.id)).size !== options.length ||
      new Set(options.map((option) => option.orderindex)).size !== options.length
    )
      invalid()
    options.sort((a, b) => a.orderindex - b.orderindex)
  }
  return {
    id,
    name: input.name,
    type: expectedType,
    required: input.required === true,
    type_config: { options },
  }
}
