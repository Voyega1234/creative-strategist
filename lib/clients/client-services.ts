export function formatSelectedServicesLabel(selectedServices: string[]) {
  if (selectedServices.length === 0) {
    return "All Services"
  }
  if (selectedServices.length === 1) {
    return selectedServices[0]
  }
  if (selectedServices.length === 2) {
    return selectedServices.join(", ")
  }
  return `${selectedServices.length} services selected`
}

export function formatSelectedServicesText(selectedServices: string[]) {
  if (selectedServices.length === 0) {
    return undefined
  }
  return selectedServices.join(", ")
}

export function toggleSelectedService(selectedServices: string[], service: string | null) {
  if (service === null) {
    return []
  }
  if (selectedServices.includes(service)) {
    return selectedServices.filter((item) => item !== service)
  }
  return [...selectedServices, service]
}
