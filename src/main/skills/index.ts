/**
 * Skills module - manages user-defined and downloaded skills.
 * Skills are stored in .aide/skills/ directory as SKILL.md files.
 */

import fs from 'node:fs'
import path from 'node:path'
import { v4 as uuid } from 'uuid'
import type { Skill, GithubSkillSearchResult } from '@shared/types'

// ─── Directory Management ────────────────────────────────────────────

/**
 * Get the skills directory path (.aide/skills/ in project root).
 * Creates the directory if it doesn't exist.
 */
export function getSkillsDirectory(): string {
  const skillsDir = path.join(process.cwd(), '.aide', 'skills')
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true })
  }
  return skillsDir
}

// ─── Frontmatter Parsing ─────────────────────────────────────────────

interface SkillFrontmatter {
  name?: string
  description?: string
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Expects format:
 * ---
 * name: skill-name
 * description: "Description"
 * ---
 * # Content
 */
function parseFrontmatter(content: string): SkillFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const yaml = match[1]
  const result: SkillFrontmatter = {}

  // Simple YAML parsing for name and description
  const nameMatch = yaml.match(/^name:\s*(.+)$/m)
  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  const descMatch = yaml.match(/^description:\s*(.+)$/m)
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  return result
}

// ─── Skill CRUD ──────────────────────────────────────────────────────

/**
 * List all skills in the skills directory.
 * Scans subdirectories for SKILL.md files and parses their frontmatter.
 */
export function listSkills(): Skill[] {
  const skillsDir = getSkillsDirectory()
  const skills: Skill[] = []

  if (!fs.existsSync(skillsDir)) return skills

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillDir = path.join(skillsDir, entry.name)
    const skillFile = path.join(skillDir, 'SKILL.md')
    const disabledFile = path.join(skillDir, 'SKILL.md.disabled')

    // Check for enabled or disabled skill file
    const isDisabled = !fs.existsSync(skillFile) && fs.existsSync(disabledFile)
    const activeFile = isDisabled ? disabledFile : skillFile

    if (!fs.existsSync(activeFile)) continue

    try {
      const content = fs.readFileSync(activeFile, 'utf-8')
      const frontmatter = parseFrontmatter(content)
      const stat = fs.statSync(activeFile)

      // Determine source from directory name (github downloads use owner--repo format)
      const isGithub = entry.name.includes('--')

      // Parse GitHub URL from skill ID
      // Format: owner--repo or owner--repo--path_._to_._dir
      let sourceUrl: string | null = null
      if (isGithub) {
        const parts = entry.name.split('--')
        const owner = parts[0]
        const repo = parts[1]
        if (parts.length === 2) {
          // Root SKILL.md
          sourceUrl = `https://github.com/${owner}/${repo}`
        } else {
          // Subdirectory SKILL.md - link to the file
          // Convert _._ back to /
          const dirPath = parts.slice(2).join('/').replace(/_\._/g, '/')
          sourceUrl = `https://github.com/${owner}/${repo}/blob/HEAD/${dirPath}/SKILL.md`
        }
      }

      skills.push({
        id: entry.name,
        name: frontmatter.name || entry.name,
        description: frontmatter.description || '',
        source: isGithub ? 'github' : 'local',
        sourceUrl,
        enabled: !isDisabled,
        path: skillDir,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString()
      })
    } catch (err) {
      console.error(`[Skills] Failed to read skill ${entry.name}:`, err)
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get a single skill by ID.
 */
export function getSkill(id: string): Skill | null {
  const skills = listSkills()
  return skills.find(s => s.id === id) || null
}

/**
 * Create a new skill from uploaded file content.
 */
export function createSkillFromFile(name: string, content: string): Skill {
  const skillsDir = getSkillsDirectory()

  // Sanitize name for directory
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const id = safeName || `skill-${uuid().slice(0, 8)}`
  const skillDir = path.join(skillsDir, id)

  // Check if already exists
  if (fs.existsSync(skillDir)) {
    throw new Error(`Skill "${id}" already exists`)
  }

  // Create directory and write file
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8')

  return getSkill(id)!
}

/**
 * Toggle skill enabled/disabled state.
 * Implemented by renaming SKILL.md ↔ SKILL.md.disabled
 */
export function toggleSkill(id: string, enabled: boolean): Skill {
  const skillsDir = getSkillsDirectory()
  const skillDir = path.join(skillsDir, id)
  const skillFile = path.join(skillDir, 'SKILL.md')
  const disabledFile = path.join(skillDir, 'SKILL.md.disabled')

  if (enabled) {
    // Enable: rename .disabled to normal
    if (fs.existsSync(disabledFile)) {
      fs.renameSync(disabledFile, skillFile)
    }
  } else {
    // Disable: rename normal to .disabled
    if (fs.existsSync(skillFile)) {
      fs.renameSync(skillFile, disabledFile)
    }
  }

  return getSkill(id)!
}

/**
 * Delete a skill and its directory.
 */
export function deleteSkill(id: string): void {
  const skillsDir = getSkillsDirectory()
  const skillDir = path.join(skillsDir, id)

  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true })
  }
}

// ─── GitHub Integration ──────────────────────────────────────────────

import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Search GitHub for skill-related repositories.
 * Appends "skill" to the query if not already present.
 */
export async function searchGithubSkills(query: string): Promise<GithubSkillSearchResult[]> {
  if (!query.trim()) return []

  try {
    // Only append "skill" if not already in query
    const searchQuery = query.toLowerCase().includes('skill') ? query : `${query} skill`

    const { stdout } = await execAsync(
      `gh search repos "${searchQuery}" --json fullName,description,stargazersCount,url --limit 15`,
      { timeout: 15000 }
    )

    const repos = JSON.parse(stdout) as Array<{
      fullName: string
      description: string | null
      stargazersCount: number
      url: string
    }>

    return repos.map(repo => ({
      fullName: repo.fullName,
      description: repo.description,
      stars: repo.stargazersCount,
      url: repo.url
    }))
  } catch (err) {
    console.error('[Skills] GitHub search failed:', err)
    return []
  }
}

/**
 * Find all SKILL.md files in a GitHub repository.
 * Returns array of file paths.
 */
export async function findSkillFilesInRepo(repoFullName: string): Promise<string[]> {
  try {
    // Use gh CLI to search for SKILL.md files in the repo
    const { stdout } = await execAsync(
      `gh api "repos/${repoFullName}/git/trees/HEAD?recursive=1" --jq ".tree[] | select(.path | test(\\"SKILL\\\\.md$\\"; \\"i\\")) | .path"`,
      { timeout: 10000 }
    )

    const paths = stdout.trim().split('\n').filter(p => p.length > 0)
    return paths
  } catch (err) {
    console.error('[Skills] Failed to find skill files:', err)
    return []
  }
}

/**
 * Download a skill from GitHub repository.
 * @param repoFullName - Repository in format "owner/repo"
 * @param filePath - Optional path to specific SKILL.md file (default: auto-detect)
 */
export async function downloadSkillFromGithub(repoFullName: string, filePath?: string): Promise<Skill> {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) {
    throw new Error('Invalid repository name. Expected format: owner/repo')
  }

  // If no path specified, find SKILL.md files
  let targetPath = filePath
  if (!targetPath) {
    const skillFiles = await findSkillFilesInRepo(repoFullName)
    if (skillFiles.length === 0) {
      throw new Error(`No SKILL.md found in ${repoFullName}`)
    }
    if (skillFiles.length > 1) {
      // Return error with available paths - frontend will handle selection
      const error = new Error('MULTIPLE_SKILLS') as Error & { paths: string[] }
      error.paths = skillFiles
      throw error
    }
    targetPath = skillFiles[0]
  }

  // Download the file
  let content: string | null = null
  for (const branch of ['HEAD', 'main', 'master']) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${targetPath}`
    try {
      const res = await fetch(url)
      if (res.ok) {
        content = await res.text()
        break
      }
    } catch {
      continue
    }
  }

  if (!content) {
    throw new Error(`Could not download ${targetPath} from ${repoFullName}`)
  }

  // Create skill directory - use path for unique id if not root
  const skillsDir = getSkillsDirectory()
  // Use _._  as separator (unlikely to appear in real paths)
  const pathSuffix = targetPath === 'SKILL.md' ? '' : `--${path.dirname(targetPath).replace(/\//g, '_._')}`
  const id = `${owner}--${repo}${pathSuffix}`
  const skillDir = path.join(skillsDir, id)

  // Remove existing if any
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true })
  }

  // Create directory and write file
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8')

  return getSkill(id)!
}
