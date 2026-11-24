// Стартовая страница: что делает сервис и обещание приватности.
import { Link } from 'react-router-dom'

/** Главная страница с кратким описанием сценария. */
export function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">ИИ-стилист и 3D-примерка по вашим меркам</h1>
      <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
        <li>Введите мерки — они остаются только на вашем устройстве.</li>
        <li>Выберите стиль, повод и бюджет.</li>
        <li>ИИ соберёт капсулу из магазинов Казахстана и подберёт размер.</li>
        <li>Посмотрите посадку на 3D-манекене и смету образа.</li>
      </ol>
      <p className="rounded-lg bg-white p-4 text-sm text-neutral-600 shadow-sm">
        Без регистрации. Мы не храним ваши мерки и фото на сервере.
      </p>
      <Link
        to="/measurements"
        className="inline-block rounded-lg bg-brand px-5 py-3 font-medium text-white"
      >
        Начать
      </Link>
    </section>
  )
}
