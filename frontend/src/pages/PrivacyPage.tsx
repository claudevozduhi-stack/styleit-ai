// Страница о приватности: что храним, где и как удалить.
import { useState } from 'react'
import { clearAllUserData } from '../storage/localStore'

/** Объясняет обработку данных и даёт удалить всё одной кнопкой. */
export function PrivacyPage() {
  const [cleared, setCleared] = useState(false)

  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Приватность</h1>
      <ul className="list-disc space-y-2 pl-5 text-neutral-700">
        <li>Регистрации нет: мы не знаем ваше имя, e-mail или телефон.</li>
        <li>Мерки и сохранённые образы хранятся только в этом браузере.</li>
        <li>
          Для расчёта мерки передаются на сервер обезличенными числами и нигде не сохраняются.
        </li>
        <li>Фото, если вы его загрузите, обрабатывается только на вашем устройстве.</li>
        <li>
          Рекомендации ИИ носят справочный характер. Перед покупкой сверяйтесь с таблицей размеров
          магазина.
        </li>
      </ul>
      <button
        type="button"
        onClick={() => {
          clearAllUserData()
          setCleared(true)
        }}
        className="rounded-lg border border-red-300 px-4 py-2 text-red-700"
      >
        Удалить мои данные
      </button>
      {cleared && <p role="status">Все данные StyleIt удалены из этого браузера.</p>}
    </section>
  )
}
