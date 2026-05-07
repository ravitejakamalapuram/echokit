# How to Use Coding Rules

This document explains how to use and maintain the `CODING_RULES.md` file.

---

## 📖 Purpose

The `CODING_RULES.md` file serves as:
1. **Reference guide** for writing high-quality code
2. **PR review checklist** for reviewers
3. **Onboarding material** for new contributors
4. **Living document** that evolves with the project

---

## 🎯 When to Reference This Document

### For Developers (Before Writing Code)
- Starting a new feature
- Unsure about a pattern to use
- Making architectural decisions
- Writing complex logic

### For Reviewers (During PR Review)
- Reviewing code quality
- Checking for common mistakes
- Ensuring consistency
- Providing constructive feedback

### For AI Assistants
- **ALWAYS** read this file before reviewing PRs
- **ALWAYS** apply these rules when writing code
- **ALWAYS** suggest improvements based on these rules
- **ALWAYS** update this file when new patterns emerge

---

## 🔄 How to Update This Document

### When to Add a New Rule

Add a new rule when you:
1. **Identify a repeated mistake** (happened 2+ times)
2. **Discover a better pattern** (improves code quality)
3. **Learn from a bug** (mistake caused production issue)
4. **Find a performance optimization** (measurable improvement)

### How to Add a New Rule

1. **Choose the right section**:
   - Code Quality Standards
   - Architecture Patterns
   - Common Mistakes
   - Performance
   - Documentation

2. **Write the rule**:
   ```markdown
   ### Rule Name
   ❌ **Bad**:
   ```code example```
   
   ✅ **Good**:
   ```code example```
   
   **Why**:
   - Reason 1
   - Reason 2
   ```

3. **Include examples**:
   - Show both bad and good code
   - Explain the reasoning
   - Link to PR if applicable

4. **Update metadata**:
   - Increment version number
   - Update "Last Updated" date
   - Add changelog entry (if major change)

---

## 📝 Template for New Rules

```markdown
### [Rule Name]
❌ **Bad**:
```[language]
// Bad code example
```

✅ **Good**:
```[language]
// Good code example
```

**Why**:
- Reason explaining the benefit
- Another reason if applicable

**Apply to**:
- Context 1
- Context 2

**Reference**: PR #123 (optional)
```

---

## 🤖 AI Assistant Instructions

When reviewing code or writing new code:

### Step 1: Load Rules
```
Before starting any code review or writing code:
1. Read memory/CODING_RULES.md
2. Review the relevant sections
3. Keep the rules in mind throughout the task
```

### Step 2: Apply Rules
```
While reviewing/writing code:
1. Check for magic numbers → Extract to constants
2. Check for missing error handling → Add try-catch
3. Check for performance issues → Apply optimizations
4. Check for missing documentation → Add JSDoc
```

### Step 3: Update Rules (If Needed)
```
After completing a task:
1. Did you discover a new pattern?
2. Did you fix a repeated mistake?
3. If yes → Update CODING_RULES.md
4. Add example and explanation
```

### Step 4: Reference in Reviews
```
When providing feedback:
1. Reference the specific rule from CODING_RULES.md
2. Include the ❌ bad and ✅ good examples
3. Explain why the rule exists
```

---

## 📊 Metrics to Track

### Code Quality Improvements
Track before/after metrics when rules are applied:
- Fewer bugs in production
- Faster code reviews
- Better performance
- Easier onboarding

### Rule Effectiveness
For each rule, track:
- How often it's violated in PRs
- How often it prevents bugs
- Developer feedback

---

## 🎯 Current Focus Areas

Based on recent PRs, prioritize:
1. ✅ **Constants over magic numbers** - Applied in Phase 1+2
2. ✅ **Error handling** - All JSON.parse calls protected
3. ⚠️ **JSDoc comments** - Still needs improvement
4. ⚠️ **Unit tests** - Not yet implemented
5. ⚠️ **File size** - app.js is >2300 lines (consider splitting)

---

## 📚 Related Documents

- `CODING_RULES.md` - The main rules document
- `PR_REVIEW.md` - Example of thorough PR review
- `IMPLEMENTATION_STATUS.md` - Implementation documentation template
- `WHAT_WE_BUILT.md` - User-friendly feature summary template

---

## 🔄 Changelog

### Version 1.0 (2026-05-07)
- Initial creation
- Based on Phase 1 + Phase 2 PR review
- Includes:
  - Code quality standards
  - Architecture patterns
  - Common mistakes
  - PR review checklist
  - Documentation standards

### Future Versions
Track major updates here...

---

## 💡 Tips for Maintaining This Document

### Keep It Actionable
- Every rule should have clear examples
- Every rule should explain "why"
- Every rule should be easy to follow

### Keep It Relevant
- Remove rules that are no longer applicable
- Update examples with current code
- Archive outdated patterns

### Keep It Concise
- One concept per rule
- Short explanations
- Visual examples (code snippets)

### Keep It Accessible
- Easy to navigate (table of contents)
- Searchable (good headings)
- Linkable (stable section URLs)

---

## 🎓 Learning Path

For new contributors:

1. **Start with Core Principles** (5 min read)
   - Zero breaking changes
   - Performance first
   - Progressive enhancement

2. **Read Code Quality Standards** (10 min read)
   - Constants over magic numbers
   - Error handling
   - JSDoc comments
   - Debouncing
   - Feature flags

3. **Review Common Mistakes** (5 min read)
   - What NOT to do
   - Why these are mistakes

4. **Study Architecture Patterns** (15 min read)
   - Dual interface strategy
   - Performance-optimized filtering
   - Feature flags

5. **Apply in Practice**
   - Write code following the rules
   - Review others' code using the rules
   - Update rules when you learn something new

---

## ✅ Success Criteria

This document is successful if:
- [ ] Code reviews become faster (checklist-driven)
- [ ] Fewer bugs reach production
- [ ] New contributors onboard quickly
- [ ] Team agrees on standards
- [ ] Document stays up-to-date
- [ ] Rules are actually followed

---

**Remember**: Rules exist to help, not hinder. If a rule doesn't make sense in a specific context, document why and create an exception. The goal is high-quality, maintainable code, not blind rule-following.
