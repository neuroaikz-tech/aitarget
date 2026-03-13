import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Политика конфиденциальности</h1>
        <p className="text-gray-400 text-sm mb-10">Последнее обновление: 13 марта 2026 г.</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">1. Общие положения</h2>
          <p className="text-gray-300 leading-relaxed">
            Настоящая Политика конфиденциальности описывает, как AITarget («мы», «нас», «наш») собирает,
            использует и защищает информацию, которую вы предоставляете при использовании нашего сервиса.
            Используя сервис, вы соглашаетесь с условиями настоящей политики.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">2. Какие данные мы собираем</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>Имя и адрес электронной почты при регистрации</li>
            <li>Данные Facebook аккаунта (ID пользователя, имя, email) при подключении через Facebook Login</li>
            <li>Токены доступа Facebook для управления рекламными кампаниями</li>
            <li>Данные о рекламных аккаунтах и кампаниях (название, бюджет, статус)</li>
            <li>Технические данные: IP-адрес, тип браузера, данные сессии</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">3. Как мы используем данные</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>Для предоставления функций сервиса: создание и управление рекламными кампаниями</li>
            <li>Для аутентификации и обеспечения безопасности аккаунта</li>
            <li>Для AI-анализа рекламных кампаний и формирования рекомендаций</li>
            <li>Для уведомлений через Telegram (при наличии настройки)</li>
            <li>Для улучшения качества сервиса</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">4. Хранение данных</h2>
          <p className="text-gray-300 leading-relaxed">
            Данные хранятся на защищённых серверах. Токены доступа Facebook хранятся в зашифрованном виде
            и используются исключительно для выполнения запросов к Facebook Marketing API от вашего имени.
            Мы не передаём ваши данные третьим лицам, за исключением случаев, предусмотренных законодательством.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">5. Данные Facebook</h2>
          <p className="text-gray-300 leading-relaxed">
            При использовании Facebook Login мы получаем данные в соответствии с разрешениями, которые вы
            предоставляете. Мы используем Facebook API только для управления рекламой от вашего имени.
            Мы соблюдаем <a href="https://developers.facebook.com/policy/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Политику платформы Facebook</a> и{' '}
            <a href="https://www.facebook.com/policy.php" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Политику конфиденциальности Facebook</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">6. Ваши права</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>Вы можете запросить удаление своих данных в любое время</li>
            <li>Вы можете отключить Facebook аккаунт в настройках сервиса</li>
            <li>Вы можете удалить свой аккаунт и все связанные данные</li>
          </ul>
          <p className="text-gray-300 mt-3">
            Для удаления данных перейдите на страницу{' '}
            <a href="/data-deletion" className="text-blue-400 hover:underline">запроса удаления данных</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">7. Контакты</h2>
          <p className="text-gray-300 leading-relaxed">
            По вопросам конфиденциальности обращайтесь: <a href="mailto:support@neuroai.kz" className="text-blue-400 hover:underline">support@neuroai.kz</a>
          </p>
        </section>
      </div>
    </div>
  );
}
