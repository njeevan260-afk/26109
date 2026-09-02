import { TFunction } from 'i18next';

const HIGH_RISK_ALERT = /^(.+) classified HIGH risk \((\d+)% prototype signal\)\. Inspect the animal and confirm clinically\.$/;

export function translateAlertMessage(t: TFunction, message: string) {
  const match = message.match(HIGH_RISK_ALERT);
  if (match) {
    return t('alertsPage.highRiskMessage', { tag: match[1], risk: match[2] });
  }
  if (message === 'Mastitis risk detected.') {
    return t('alertsPage.mastitisDetected');
  }
  return message;
}
