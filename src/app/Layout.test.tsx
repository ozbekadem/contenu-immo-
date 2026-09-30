import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './App'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }),
}))

function afficher(chemin = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [chemin] })
  return render(<RouterProvider router={router} />)
}

describe('Mise en page', () => {
  it("affiche les onglets du bas et le bouton « Repérer »", () => {
    afficher()
    const onglets = screen.getByRole('navigation', { name: 'Onglets' })
    for (const nom of ["Aujourd'hui", 'Prospection', 'Contacts', 'Agenda', 'Plus']) {
      expect(onglets).toHaveTextContent(nom)
    }
    expect(screen.getAllByRole('link', { name: /Repérer/ }).length).toBeGreaterThan(0)
  })

  it("affiche l'accueil avec les compteurs de relances", () => {
    afficher()
    expect(screen.getByRole('heading', { level: 1, name: /^(Bonjour|Bon après-midi|Bonsoir) !$/ })).toBeInTheDocument()
    for (const libelle of ['En retard', "Aujourd'hui", 'Semaine', 'À jour']) {
      expect(screen.getAllByText(libelle).length).toBeGreaterThan(0)
    }
  })

  it('masque les onglets en mode capture terrain', async () => {
    afficher('/reperer')
    expect(await screen.findByRole('heading', { name: 'Repérer' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Onglets' })).not.toBeInTheDocument()
  })
})
