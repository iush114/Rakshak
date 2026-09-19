import os
import pickle

user_input = input("Enter code: ")

result = eval(user_input)

data = pickle.loads(user_input)

os.system("ping " + user_input)
