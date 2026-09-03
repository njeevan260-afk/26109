import { TFunction } from 'i18next';

const ELEVATED_RISK_ALERT = /^(.+) classified (HIGH|MODERATE) risk \((\d+)% prototype signal\)\./;

export function translateAlertMessage(t: TFunction, message: string) {
  const match = message.match(ELEVATED_RISK_ALERT);
  if (match) {
    return t('alertsPage.elevatedRiskMessage', {
      tag: match[1],
      level: t(`common.${match[2].toLowerCase()}`),
      risk: match[3],
    });
  }
  if (message === 'Mastitis risk detected.') {
    return t('alertsPage.mastitisDetected');
  }
  return message;
}
