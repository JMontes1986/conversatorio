import { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://conversatorio-colgemelli.web.app'; // Reemplazar con el dominio de producción

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: `${baseUrl}/scoreboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/programacion`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
     {
      url: `${baseUrl}/draw`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
     {
      url: `${baseUrl}/debate`,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 0.5,
    },
     {
      url: `${baseUrl}/survey`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/scoring/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
     {
      url: `${baseUrl}/moderator/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
     {
      url: `${baseUrl}/admin/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]
}