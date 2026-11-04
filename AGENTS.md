#   Exam Creator

A web application to conduct quiz in full screen mode


##  Frontend

-   Use Next.js for frontend
-   It should be ultra-modern
-   Store all frontend in `frontend` folder
-   There are login dashboards for both the teacher and the students
-   Teacher's login credentials are hardwired in `.env` file
-   Student's login credentials are stored in Supabase table `student` as `username` and `password`
-   Teacher can login to upload the quiz questions as a zip file which is stored as `./frontend/quiz.zip`. The zip folder contains a `quiz.json` whose format of the json file is below and `figures` folder:

```json
    [
        {
        "question": "Consider an array consisting of following elements in sequence: 9,10,14,37,14,32,41,10,11,34,7. If bubble algorithm is used for sorting,what will be the array after two complete iterations",
        "figure": "./figures/Fig1.jpg",
        "options": {
            "A": "10,10,14,29,32,14,11,7,34,37,41",
            "B": "10,14,14,29,32,10,11,7,34,37,41",
            "C": "10,14,14,29,32,10,11,34,7,37,41",
            "D": "None"
        },
        "figures_options": {
            "A": "./figures/fig2.jpg",
            "B": "",
            "C": "./figures/fig3.jpg",
            "D": ""
        },
        "Answer": "C"
        },
        {
        "question": "Consider an array consisting of the following elements in sequence: 29,10,14,37,14,32,41,10,11,34,7. What will be the contents in the array after 3 iterations if insertion sort is used.",
        "options": {
            "A": "10,14,37,29,14,32,41,10,11,34,7",
            "B": "10,14,29,37,32,14,41,10,11,34,7",
            "C": "10,14,14,29,32,10,11,34,7,37,41",
            "D": "None"
        },
        "Answer": "D"
        },
        {
        "question": "In a fully connected non-directed graph with self-loops on all nodes, if there are 20 nodes, the number of edges will be:",
        "options": {
            "A": "190",
            "B": "390",
            "C": "400",
            "D": "200"
        },
        "Answer": "D"
        }
    ]
```
-   The `figures` contains figures that can be embedded along with question and the options.
-   The teacher can also assign the start date and time; end date and time for the quiz.
-   A create quiz button when pressed populates the student's dashboard with the question and options. The figures should also be rendered if the question or the options have the figure paths. The options are radio buttons.
-   Also the current time remaining is displayed on top left
-   The student must answer all questions to submit the quiz, else he cannot submit
-   The student once enters the website, his view becomes full screen. Full screen has to be enforced strictly. He cannot close the application nor open any other tab/window/application until he submits his quiz. No shortcut buttons like escape key, etc., will work. 

## Backend
-   Use Node.js for backend
-   The supabase credentials are stored in `.env` file
-   The answers to each question should not be made visibile to the student. It is only to verify his answers and generate score
-   Each correct answer increases score by 1; there is no negative marking.
-   After the student submits his quiz, his total score will be stored under the column `quiz` in the `student` table. His `quiz_status` will become 1, indicating he has given the quiz and cannot give it again.
-   After he submit the application closes itself.
-   If timer goes to zero, the quiz gets autosubmitted.
-   If violations are exceed 3, he quiz gets autosubmitted. Everytime a warning will be displayed along with the remaining violations.
-   Also record the number of violations in `violations` column of the table

##  Requirements
-   Perform all scaffolding and testing
-   Generate vercel file to be upload it to vercel
-   DO NOT hash the passwords as they are needed for student login
-   Full screen has to be enforced strictly
-   DO NOT put unneccesary hints and details of tools, databases used for the project.



