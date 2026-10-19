export declare const FIELD_IDS: Readonly<{
  type: '4c3befc0-5146-43a2-8610-86efe4e8124a'
  department: '9b3d2027-2162-42e2-81b9-d907592cdb5b'
  largeFile: '4f7eb8a3-5de7-4f3b-87bb-8be5dc2d573f'
}>
export declare const FIELD_DEFINITIONS: readonly [
  Readonly<{ id: typeof FIELD_IDS.type; type: 'drop_down' }>,
  Readonly<{ id: typeof FIELD_IDS.department; type: 'drop_down' }>,
  Readonly<{ id: typeof FIELD_IDS.largeFile; type: 'text' }>,
]
export declare function parseSupportField(
  input: unknown,
  id: string,
  expectedType: 'drop_down' | 'text',
): {
  id: string
  name: string
  type: 'drop_down' | 'text'
  required: boolean
  type_config: {
    options: Array<{ id: string; name: string; color: string | null; orderindex: number }>
  }
}
