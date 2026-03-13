import { useState } from 'react';

export default function DataDeletionPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Имитация отправки запроса
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Удаление данных</h1>
        <p className="text-gray-400 text-sm mb-10">Запрос на удаление персональных данных</p>

        <section className="mb-8">
          <p className="text-gray-300 leading-relaxed mb-4">
            В соответствии с нашей <a href="/privacy" className="text-blue-400 hover:underline">Политикой конфиденциальности</a>,
            вы имеете право запросить удаление всех ваших персональных данных из нашей системы.
          </p>
          <p className="text-gray-300 leading-relaxed mb-4">
            После получения запроса мы удалим:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2 mb-6">
            <li>Ваш аккаунт и профиль</li>
            <li>Подключённые Facebook аккаунты и токены доступа</li>
            <li>Историю AI-анализов и настройки</li>
            <li>Все персональные данные, связанные с вашим аккаунтом</li>
          </ul>
          <p className="text-gray-400 text-sm mb-8">
            Обратите внимание: рекламные кампании, созданные через Facebook, останутся в вашем
            Facebook Ads Manager и не будут удалены нами.
          </p>
        </section>

        {submitted ? (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 text-center">
            <div className="text-green-400 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-white mb-2">Запрос принят</h2>
            <p className="text-gray-300">
              Мы получили ваш запрос на удаление данных. В течение 30 дней все ваши данные
              будут удалены из нашей системы. Подтверждение будет отправлено на{' '}
              <span className="text-white font-medium">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Заполните форму запроса</h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Email аккаунта *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" required className="mt-1 accent-blue-500" />
                <span className="text-sm text-gray-300">
                  Я подтверждаю, что хочу удалить все мои данные из сервиса AITarget.
                  Это действие необратимо.
                </span>
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Отправка...' : 'Запросить удаление данных'}
            </button>
          </form>
        )}

        <p className="text-gray-500 text-sm mt-6 text-center">
          Также вы можете написать напрямую: <a href="mailto:support@neuroai.kz" className="text-blue-400 hover:underline">support@neuroai.kz</a>
        </p>
      </div>
    </div>
  );
}
