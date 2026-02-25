# ─────────────────────────────────────────────────────────────────────────────
# discordjs-plus — Ready-to-run commands
# Copy and run these in order. Replace <values> where indicated.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. SETUP (run once after extracting the zip) ─────────────────────────────

npm install

# ── 2. CREATE NPM ACCOUNT / LOGIN ────────────────────────────────────────────
# If you don't have an account: https://www.npmjs.com/signup
# Then login in the terminal:

# (It will ask for your username, password, email, and OTP if 2FA is enabled)
# If you prefer using a token directly:
#   npm set //registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN

# ── 3. PUBLISH TO NPM ────────────────────────────────────────────────────────

npm publish --access public

# If the name "discordjs-plus" is taken, edit package.json first:
#   "name": "@your-username/discordjs-plus"
# Then run:
#   npm publish --access public


# ── 4. GIT — Initialize and push to GitHub ───────────────────────────────────

# 4.1 — Initialize the local repo
git init
git add .
git commit -m "feat: initial release v1.0.0

- PollManager: full Discord Polls API (create, end, voters, results)
- SoundboardManager: full Soundboard API (backport for < 14.16)
- ApplicationEmojiManager: app emojis (backport for < 14.16)
- ForumTagManager: atomic tag add/remove/edit/reorder
- GuildOnboardingManager: full onboarding CRUD
- VoiceMessageBuilder: voice message payload builder
- PollBuilder: fluent poll configuration builder
- SafeCollector: memory-leak-safe collector replacement
- RateLimitQueue: priority queue with retry on 429
- BurstReactionManager: super/burst reaction support
- applyPatches: fixes awaitReactions idle bug, adds Collection#findAll,
  groupBy, random, GuildMember#guildBannerURL, sendTypingFor, safeCrosspost"

  # 4.2 — Create a repo on GitHub (go to https://github.com/new)
  # Then connect and push:

  git remote add origin https://github.com/doyimmiu5/discord.js-plus.git
  git branch -M main
  git push -u origin main


  # ── 5. ADD A GIT TAG FOR THE VERSION ─────────────────────────────────────────

  git tag v1.0.0
  git push origin v1.0.0


  # ── 6. UPDATING IN THE FUTURE ────────────────────────────────────────────────

  # Bump patch version (1.0.0 → 1.0.1)
  npm version patch

  # Bump minor version (1.0.0 → 1.1.0)
  npm version minor

  # Bump major version (1.0.0 → 2.0.0)
  npm version major

  # Publish the new version
  npm publish --access public

  # Push the new commit + tag that npm version created
  git push --follow-tags


  # ── 7. RECOMMENDED .gitignore ────────────────────────────────────────────────
  # Create a .gitignore with:

  cat > .gitignore << 'EOF'
  node_modules/
  .env
  *.log
  .DS_Store
  EOF