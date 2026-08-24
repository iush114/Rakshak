export interface Repository {
  id: string;
  name: string;
  owner: string;
  branch: string;
  lastUpdated: string;
  filesCount: number;
  dependenciesCount: number;
  language: string;
  visibility: 'Public' | 'Private';
  starsCount: number;
  forksCount: number;
  githubUrl: string;
}

export const mockRepositories: Repository[] = [
  {
    id: 'repo-1',
    name: 'rakshak-security',
    owner: 'Anushka',
    branch: 'main',
    lastUpdated: '2 hours ago',
    filesCount: 128,
    dependenciesCount: 47,
    language: 'Python',
    visibility: 'Private',
    starsCount: 384,
    forksCount: 42,
    githubUrl: 'https://github.com/'
  },
  {
    id: 'repo-2',
    name: 'devsecops-demo',
    owner: 'Anushka',
    branch: 'main',
    lastUpdated: '5 hours ago',
    filesCount: 215,
    dependenciesCount: 62,
    language: 'Go / Docker',
    visibility: 'Public',
    starsCount: 512,
    forksCount: 89,
    githubUrl: 'https://github.com/'
  },
  {
    id: 'repo-3',
    name: 'ecommerce-app',
    owner: 'Anushka',
    branch: 'main',
    lastUpdated: '1 day ago',
    filesCount: 89,
    dependenciesCount: 38,
    language: 'JavaScript',
    visibility: 'Private',
    starsCount: 120,
    forksCount: 18,
    githubUrl: 'https://github.com/'
  },
  {
    id: 'repo-4',
    name: 'student-management',
    owner: 'Anushka',
    branch: 'main',
    lastUpdated: '2 days ago',
    filesCount: 64,
    dependenciesCount: 29,
    language: 'Java',
    visibility: 'Public',
    starsCount: 45,
    forksCount: 8,
    githubUrl: 'https://github.com/'
  },
  {
    id: 'repo-5',
    name: 'portfolio',
    owner: 'Anushka',
    branch: 'main',
    lastUpdated: '3 days ago',
    filesCount: 32,
    dependenciesCount: 14,
    language: 'React / TypeScript',
    visibility: 'Public',
    starsCount: 92,
    forksCount: 14,
    githubUrl: 'https://github.com/'
  }
];
