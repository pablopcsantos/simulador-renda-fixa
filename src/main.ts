/*
  SIMULADOR DE RENDA FIXA / FIXED-INCOME SIMULATOR

  Aplicação multiplataforma de simulação financeira desenvolvida de forma independente por
  Pablo Phillipe Cândido dos Santos para comparação educacional de produtos de renda fixa.
  Cross-platform financial simulation application independently developed by
  Pablo Phillipe Cândido dos Santos for educational comparison of fixed-income products.

  Ferramentas de inteligência artificial generativa foram utilizadas como recurso auxiliar,
  mantendo-se sob responsabilidade do autor a concepção, implementação, integração e verificação.
  Generative AI tools were used as auxiliary resources; the author remains responsible for
  the project's conception, implementation, integration, and verification.

  Currículo Lattes / Lattes CV: http://lattes.cnpq.br/9500873674712528
*/

import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Elemento #app não encontrado.');
}

mount(App, { target });
