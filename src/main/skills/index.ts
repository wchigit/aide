/**
 * Skills module - manages user-defined and downloaded skills.
 * Skills are stored in .aide/skills/ directory as SKILL.md files.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { v4 as uuid } from 'uuid'
import type { Skill, GithubSkillSearchResult } from '@shared/types'

const execFileAsync = promisify(execFile)

// ─── Directory Management ────────────────────────────────────────────

/**
 * Get the skills directory path (~/.aide/skills/ in user home).
 * Creates the directory if it doesn't exist.
 * Uses os.homedir() for stable path across different launch methods.
 */
export function getSkillsDirectory(): string {
  const skillsDir = path.join(os.homedir(), '.aide', 'skills')
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
 * Source information is read from .source.json if present.
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
    const sourceFile = path.join(skillDir, '.source.json')

    // Check for enabled or disabled skill file
    const isDisabled = !fs.existsSync(skillFile) && fs.existsSync(disabledFile)
    const activeFile = isDisabled ? disabledFile : skillFile

    if (!fs.existsSync(activeFile)) continue

    try {
      const content = fs.readFileSync(activeFile, 'utf-8')
      const frontmatter = parseFrontmatter(content)
      const stat = fs.statSync(activeFile)

      // Check for source metadata file (new format)
      let source: 'local' | 'marketplace' | 'github-search' = 'local'
      let sourceId: string | undefined
      let sourceUrl: string | null = null
      let verified = false

      if (fs.existsSync(sourceFile)) {
        // Read source info from .source.json
        try {
          const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'))
          // Determine source type
          if (sourceData.sourceType === 'github-search') {
            source = 'github-search'
          } else if (sourceData.sourceType) {
            source = 'marketplace'
          }
          sourceId = sourceData.sourceId
          sourceUrl = sourceData.sourceUrl || (sourceData.owner && sourceData.repo 
            ? `https://github.com/${sourceData.owner}/${sourceData.repo}` 
            : null)
          verified = sourceData.sourceType === 'official' || sourceData.sourceType === 'community'
        } catch {
          // Ignore parse errors
        }
      } else {
        // Legacy format: parse from directory name
        const parts = entry.name.split('--')
        
        if (parts[0] === 'official' || parts[0] === 'community' || parts[0] === 'private') {
          source = 'marketplace'
          const sourceType = parts[0]
          sourceId = sourceType === 'official' ? 'aide-official' 
                   : sourceType === 'community' ? 'anthropic-community'
                   : `private-${parts[1]}`
          if (parts.length >= 3) {
            const owner = parts[1]
            const repo = parts[2]
            sourceUrl = `https://github.com/${owner}/${repo}`
          }
          verified = sourceType === 'official' || sourceType === 'community'
        } else if (parts.length >= 2 && !parts[0].startsWith('local')) {
          source = 'github-search'
          const owner = parts[0]
          const repo = parts[1]
          if (parts.length === 2) {
            sourceUrl = `https://github.com/${owner}/${repo}`
          } else {
            const dirPath = parts.slice(2).join('/').replace(/_\._/g, '/')
            sourceUrl = `https://github.com/${owner}/${repo}/blob/HEAD/${dirPath}/SKILL.md`
          }
        }
      }

      skills.push({
        id: entry.name,
        name: frontmatter.name || entry.name,
        description: frontmatter.description || '',
        source,
        sourceId,
        sourceUrl,
        verified,
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
 * Create a new skill from uploaded folder.
 * Expects an array of files with relative paths.
 * Folder structure should follow Anthropic format:
 *   skills/
 *     my-skill/
 *       SKILL.md       <- Required
 *       examples/      <- Optional
 *       templates/     <- Optional
 */
export function createSkillFromFolder(
  files: Array<{ path: string; content: string }>
): Skill {
  // Find SKILL.md to determine skill name
  const skillMdFile = files.find(f => 
    f.path.toLowerCase().endsWith('skill.md') || 
    f.path.toLowerCase() === 'skill.md'
  )
  
  if (!skillMdFile) {
    throw new Error('No SKILL.md found in uploaded folder. Please include a SKILL.md file.')
  }
  
  // Extract skill name from frontmatter first, then from path
  let skillName: string | null = null
  
  // Try to get name from frontmatter
  const frontmatterMatch = skillMdFile.content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (frontmatterMatch) {
    const nameMatch = frontmatterMatch[1].match(/^name:\s*(.+)$/m)
    if (nameMatch) {
      skillName = nameMatch[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  
  // Fallback to directory name
  if (!skillName) {
    const pathParts = skillMdFile.path.split(/[/\\]/)
    if (pathParts.length > 1) {
      skillName = pathParts[pathParts.length - 2]
    } else {
      skillName = `skill-${uuid().slice(0, 8)}`
    }
  }
  
  // Sanitize name for directory
  const safeName = skillName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  
  const skillsDir = getSkillsDirectory()
  const skillDir = path.join(skillsDir, safeName)
  
  // Check for existing skill with same name - always reject duplicates
  if (fs.existsSync(skillDir)) {
    throw new Error(
      `A skill named "${skillName}" already exists. ` +
      `Please rename your skill or delete the existing one first.`
    )
  }
  
  // Create directory
  fs.mkdirSync(skillDir, { recursive: true })
  
  // Find the common prefix to strip (the uploaded folder name)
  const skillMdDir = path.dirname(skillMdFile.path)
  const prefix = skillMdDir === '.' ? '' : skillMdDir + '/'
  
  // Write all files, preserving relative structure
  for (const file of files) {
    // Calculate relative path within skill directory
    let relativePath = file.path
    if (prefix && relativePath.startsWith(prefix)) {
      relativePath = relativePath.slice(prefix.length)
    }
    
    const filePath = path.join(skillDir, relativePath)
    const fileDir = path.dirname(filePath)
    
    // Create subdirectory if needed
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true })
    }
    
    fs.writeFileSync(filePath, file.content, 'utf-8')
  }
  
  // Save source metadata
  const sourceMetadata = {
    sourceType: 'local',
    installedAt: new Date().toISOString()
  }
  fs.writeFileSync(path.join(skillDir, '.source.json'), JSON.stringify(sourceMetadata, null, 2), 'utf-8')
  
  console.log(`[Skills] Created local skill "${safeName}" with ${files.length} file(s)`)
  
  return getSkill(safeName)!
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

/**
 * Search GitHub for skill-related repositories.
 * Appends "skill" to the query if not already present.
 * Uses execFile with argument array to prevent command injection.
 */
export async function searchGithubSkills(query: string): Promise<GithubSkillSearchResult[]> {
  if (!query.trim()) return []

  try {
    // Only append "skill" if not already in query
    const searchQuery = query.toLowerCase().includes('skill') ? query : `${query} skill`

    const { stdout } = await execFileAsync(
      'gh',
      ['search', 'repos', searchQuery, '--json', 'fullName,description,stargazersCount,url', '--limit', '15'],
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
 * Validate repository name format to prevent injection.
 */
function isValidRepoName(repoFullName: string): boolean {
  // Valid format: owner/repo where both are alphanumeric with - _ .
  const repoPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/
  return repoPattern.test(repoFullName)
}

/**
 * Find all SKILL.md files in a GitHub repository.
 * Returns array of file paths.
 * Uses execFile with argument array to prevent command injection.
 */
export async function findSkillFilesInRepo(repoFullName: string): Promise<string[]> {
  // Validate repo name format to prevent injection
  if (!isValidRepoName(repoFullName)) {
    console.error('[Skills] Invalid repository name format:', repoFullName)
    return []
  }

  try {
    // Use gh CLI to search for SKILL.md files in the repo
    // Use endswith instead of regex to avoid escaping issues
    const { stdout } = await execFileAsync(
      'gh',
      [
        'api',
        `repos/${repoFullName}/git/trees/HEAD?recursive=1`,
        '--jq',
        '.tree[] | select(.path | ascii_downcase | endswith("skill.md")) | .path'
      ],
      { timeout: 30000 }
    )

    const paths = stdout.trim().split('\n').filter(p => p.length > 0)
    console.log(`[Skills] Found ${paths.length} SKILL.md files in ${repoFullName}`)
    return paths
  } catch (err) {
    console.error('[Skills] Failed to find skill files:', err)
    return []
  }
}

/**
 * Download all files from a GitHub repository directory.
 */
async function downloadDirectoryFromGithub(
  owner: string,
  repo: string,
  dirPath: string,
  localDir: string
): Promise<void> {
  try {
    // Get full tree from GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AIDE-App'
      }
    })

    if (!res.ok) {
      console.error(`[Skills] GitHub API error: ${res.status}`)
      return
    }

    const data = await res.json() as { tree: Array<{ path: string; type: string }> }

    // Filter files within target directory
    const prefix = dirPath === '.' ? '' : dirPath + '/'
    const files = data.tree.filter(item =>
      item.type === 'blob' &&
      (dirPath === '.' ? !item.path.includes('/') || item.path === 'SKILL.md' : item.path.startsWith(prefix))
    )

    // For root level, only include SKILL.md and immediate subdirectory contents
    const targetFiles = dirPath === '.'
      ? files.filter(f => f.path === 'SKILL.md' || !f.path.includes('/'))
      : files

    console.log(`[Skills] Found ${targetFiles.length} files in ${dirPath}`)

    // Download each file
    for (const file of targetFiles) {
      const relativePath = dirPath === '.' ? file.path : file.path.slice(prefix.length)
      const localFilePath = path.join(localDir, relativePath)

      // Create subdirectory if needed
      const localFileDir = path.dirname(localFilePath)
      if (!fs.existsSync(localFileDir)) {
        fs.mkdirSync(localFileDir, { recursive: true })
      }

      // Download file
      for (const branch of ['HEAD', 'main', 'master']) {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`
        try {
          const fileRes = await fetch(url)
          if (fileRes.ok) {
            const content = await fileRes.text()
            fs.writeFileSync(localFilePath, content, 'utf-8')
            console.log(`[Skills] Downloaded: ${relativePath}`)
            break
          }
        } catch {
          continue
        }
      }
    }
  } catch (err) {
    console.error(`[Skills] Failed to download directory:`, err)
  }
}

/**
 * Download a skill from GitHub repository.
 * Downloads the entire skill directory (parent of SKILL.md).
 * Uses the skill name from SKILL.md as directory name for SDK compatibility.
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

  // Get skill directory path (parent of SKILL.md)
  const skillDirPath = path.dirname(targetPath)  // e.g., "skills/code-review" or "."
  const fallbackName = skillDirPath === '.' ? repo : path.basename(skillDirPath)

  // First, fetch SKILL.md to get the actual skill name
  let skillContent: string | null = null
  for (const branch of ['HEAD', 'main', 'master']) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${targetPath}`
    try {
      const res = await fetch(url)
      if (res.ok) {
        skillContent = await res.text()
        break
      }
    } catch {
      continue
    }
  }
  
  if (!skillContent) {
    throw new Error(`Could not download ${targetPath} from ${repoFullName}`)
  }

  // Parse frontmatter for skill name
  const frontmatterMatch = skillContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  let skillName = fallbackName
  
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1]
    const nameMatch = yaml.match(/^name:\s*(.+)$/m)
    if (nameMatch) {
      skillName = nameMatch[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  
  // Sanitize skill name for directory
  const safeName = skillName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // Create local skill directory using skill name
  const skillsDir = getSkillsDirectory()
  const skillDir = path.join(skillsDir, safeName)

  // Remove existing if any
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true })
  }

  // Create directory
  fs.mkdirSync(skillDir, { recursive: true })

  // Download entire skill directory
  await downloadDirectoryFromGithub(owner, repo, skillDirPath, skillDir)

  // Ensure SKILL.md exists
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(skillMdPath)) {
    fs.writeFileSync(skillMdPath, skillContent, 'utf-8')
  }

  // Save source metadata for tracking
  const sourceMetadata = {
    sourceType: 'github-search',
    owner,
    repo,
    originalPath: targetPath,
    repoUrl: `https://github.com/${owner}/${repo}`,
    installedAt: new Date().toISOString()
  }
  fs.writeFileSync(path.join(skillDir, '.source.json'), JSON.stringify(sourceMetadata, null, 2), 'utf-8')

  // Count files
  const countFiles = (dir: string): number => {
    let count = 0
    const items = fs.readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      if (item.isFile() && !item.name.startsWith('.')) count++
      else if (item.isDirectory()) count += countFiles(path.join(dir, item.name))
    }
    return count
  }
  console.log(`[Skills] Installed skill "${skillName}" from ${repoFullName} with ${countFiles(skillDir)} file(s)`)

  return getSkill(safeName)!
}
