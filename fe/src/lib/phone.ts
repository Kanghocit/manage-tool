export const VN_MOBILE_REGEX = /^0(3|5|7|8|9)\d{8}$/

export function normalizeVnPhone(input: string): string {
  let s = input.trim().replace(/[\s.\-]/g, "")
  if (s.startsWith("+84")) {
    s = "0" + s.slice(3)
  } else if (s.startsWith("84") && s.length >= 11) {
    s = "0" + s.slice(2)
  }
  return s
}

export function isValidVnMobilePhone(input: string): boolean {
  return VN_MOBILE_REGEX.test(normalizeVnPhone(input))
}
