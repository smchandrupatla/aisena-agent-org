export interface ConfigFormProps<T> {
  value: Partial<T>
  onChange: (patch: Partial<T>) => void
}
