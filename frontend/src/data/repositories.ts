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
  targetPath: string;
}

export const mockRepositories: Repository[] = [
  {
    id: 'repo-test-project',
    name: 'test-project',
    owner: 'Rakshak',
    branch: 'main',
    lastUpdated: 'Live Target',
    filesCount: 12,
    dependenciesCount: 8,
    language: 'Python',
    visibility: 'Private',
    starsCount: 42,
    forksCount: 5,
    githubUrl: 'https://github.com/',
    targetPath: 'test-project'
  },
  {
    id: 'repo-rakshak-core',
    name: 'Rakshak',
    owner: 'Rakshak',
    branch: 'main',
    lastUpdated: 'Active Workspace',
    filesCount: 64,
    dependenciesCount: 22,
    language: 'Python / TypeScript',
    visibility: 'Private',
    starsCount: 128,
    forksCount: 16,
    githubUrl: 'https://github.com/',
    targetPath: 'test-project'
  }
];
