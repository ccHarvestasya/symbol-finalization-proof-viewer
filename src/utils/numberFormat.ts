export const formatStringNumber = (value: string): string => {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export const formatXymString = (value: string): string => {
  return value
    .padStart(7, '0')
    .replace(/(\d*)(\d{6})$/g, '$1.$2')
    .replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
}
