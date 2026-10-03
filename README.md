# Agada Tech Platform

A public library of deploy recipes. It runs nothing of its own. A project calls a workflow or a Terraform module and pins a version (`@v1`). Credentials, account ids and service ids stay in the caller. None of them belong in this repo.

Local path: `~/workspace/agada-tech-platform`. The GitHub owner is not chosen yet.

```
.github/workflows/     reusable workflows (not extracted yet)
terraform/modules/     render-service, cloudflare-worker, supabase-project (empty)
ansible/roles/         empty until the Oracle box work exists
infra/                 this repo's agent and board
```

The first recipes are still to be written. Until then the directories are only the layout.
