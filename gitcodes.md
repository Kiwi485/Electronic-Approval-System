git clone 朋友的github連結 //把github的檔案丟到vscode裡面

git status //查看當前有無修改、新檔案、刪除檔案的動作
git add . //新增所有添加的檔案

git commit -m "" //儲存操作的動作至github

git log --oneline //顯示所有commit的名稱以及編號

git diff (commit編號) -- 檔案名稱 //我在那個commit編號的檔案做了甚麼改動
git checkout (commit編號) -- 檔案名稱 //還原到commit編號前做的動作
git reset --hard commit編號 //還原到該commit編號並刪除該commit之後的動作**該動作不可逆**

git branch //查看當前branch分支

git checkout -b (branch名稱) //新增一個新的分支

git push origin (當前branch分支名稱) //將自己分支所修改的push到github並可請求main分支修改

git push //直接把main分支push到github上，此動作會直接覆蓋檔案

git pull //將github檔案pull到自己vscode
