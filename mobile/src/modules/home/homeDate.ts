import { getLocalDateContext } from '../../shared/date/localDate';

export function getHomeActionDate(): string {
  return getLocalDateContext().currentLocalDate;
}