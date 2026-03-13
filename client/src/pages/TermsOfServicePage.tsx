import React from 'react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Условия использования</h1>
        <p className="text-gray-400 text-sm mb-10">Последнее обновление: 13 марта 2026 г.</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">1. Принятие условий</h2>
          <p className="text-gray-300 leading-relaxed">
            Используя сервис AITarget, вы соглашаетесь с настоящими Условиями использования.
            Если вы не согласны с условиями — пожалуйста, не используйте сервис.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">2. Описание сервиса</h2>
          <p className="text-gray-300 leading-relaxed">
            AITarget — платформа для автоматизированного управления рекламными кампаниями в Facebook и Instagram
            с использованием искусственного интеллекта. Сервис предоставляет инструменты для создания,
            оптимизации и анализа рекламы через Facebook Marketing API.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">3. Регистрация и аккаунт</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>Вы несёте ответственность за сохранность данных своего аккаунта</li>
            <li>Вы обязаны предоставлять достоверную информацию при регистрации</li>
            <li>Один человек — один аккаунт</li>
            <li>Передача аккаунта третьим лицам запрещена</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">4. Использование Facebook API</h2>
          <p className="text-gray-300 leading-relaxed">
            Для работы сервиса вы предоставляете доступ к своему Facebook аккаунту и рекламным аккаунтам.
            Вы несёте ответственность за все рекламные кампании, созданные через наш сервис.
            Вы обязаны соблюдать <a href="https://www.facebook.com/policies/ads/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Правила рекламы Facebook</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">5. Запрещённое использование</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>Создание рекламы, нарушающей правила Facebook и Instagram</li>
            <li>Использование сервиса для незаконной деятельности</li>
            <li>Попытки взлома или обхода защиты сервиса</li>
            <li>Автоматизированный доступ без явного разрешения</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">6. Ответственность</h2>
          <p className="text-gray-300 leading-relaxed">
            Сервис предоставляется «как есть». Мы не несём ответственности за результаты рекламных кампаний,
            изменения в алгоритмах Facebook, временную недоступность Facebook API, а также за любые
            косвенные убытки, связанные с использованием сервиса.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">7. Изменение условий</h2>
          <p className="text-gray-300 leading-relaxed">
            Мы оставляем за собой право изменять настоящие условия. О существенных изменениях мы уведомим
            вас по электронной почте или через интерфейс сервиса.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">8. Контакты</h2>
          <p className="text-gray-300 leading-relaxed">
            По вопросам: <a href="mailto:support@neuroai.kz" className="text-blue-400 hover:underline">support@neuroai.kz</a>
          </p>
        </section>
      </div>
    </div>
  );
}
