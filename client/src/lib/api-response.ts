export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export function unwrapApiData<T>(payload: T | ApiSuccess<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    (payload as ApiSuccess<T>).success === true &&
    "data" in payload
  ) {
    return (payload as ApiSuccess<T>).data;
  }

  return payload as T;
}
